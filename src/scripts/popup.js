/// <reference path="./index.d.ts" />

import browser from 'webextension-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { addSeconds, differenceInSeconds } from 'date-fns';

import { secToHhmmImproved } from './@toggl/time-format-utils';
import { formatDuration } from './@toggl/time-format-utils/format-duration';
import Summary from './components/Summary';
import TimeEntriesList from './components/TimeEntriesList';
import Pomodoro from './components/Pomodoro';
import Timer from './components/Timer';
import { ProjectAutoComplete, TagAutoComplete, TaskAutoComplete } from './lib/autocomplete';
import { parseDuration } from './lib/timerUtils';
import { groupTimeEntriesByDay } from './lib/groupUtils';
import renderLogin from './initializers/login';

let TogglButton = browser.extension.getBackgroundPage().TogglButton;
const FF = navigator.userAgent.indexOf('Chrome') === -1;

if (FF) {
  document.querySelector('body').classList.add('ff');
}

const Popup = {
  $postStartText: ' post-start popup',
  $popUpButton: null,
  $errorLabel: document.querySelector('.error'),
  $projectAutocomplete: null,
  $taskAutocomplete: null,
  $tagAutocomplete: null,
  $timer: null,
  $tagsVisible: false,
  mousedownTrigger: null,
  projectBlurTrigger: null,
  newFormAdded: false,
  editFormAdded: false,
  durationChanged: false,
  $billable: null,
  $header: document.querySelector('.header'),
  $menuView: document.querySelector('#menu'),
  $editView: document.querySelector('#toggl-button-entry-form'),
  $newView: document.querySelector('#toggl-button-new-form'),
  $loginView: document.querySelector('#login-view'),
  $revokedWorkspaceView: document.querySelector('#revoked-workspace'),
  $entries: document.querySelector('.entries-list'),
  defaultErrorMessage: 'Error connecting to server',
  showPage: function () {
    let dom;
    if (!TogglButton) {
      TogglButton = browser.extension.getBackgroundPage().TogglButton;
    }

    try {
      if (TogglButton.$user !== null) {
        if (!PopUp.newFormAdded) {
          dom = document.createElement('div');
          dom.innerHTML = TogglButton.getNewForm();
          PopUp.$newView.appendChild(dom.firstChild);
          PopUp.addNewEvents();
          PopUp.newFormAdded = true;
        }

        if (!PopUp.editFormAdded) {
          dom = document.createElement('div');
          dom.innerHTML = TogglButton.getEditForm();
          PopUp.$editView.appendChild(dom.firstChild);
          PopUp.addEditEvents();
          PopUp.editFormAdded = true;
        }

        if (TogglButton.$curEntry === null) {
          if (TogglButton.$latestStoppedEntry) {
            localStorage.setItem(
              'latestStoppedEntry',
              JSON.stringify(TogglButton.$latestStoppedEntry)
            );
          }
        }
        if (!PopUp.$header.getAttribute('data-view')) {
          PopUp.switchView(PopUp.$menuView);
        }

        Popup.renderApp();
      } else {
        localStorage.setItem('latestStoppedEntry', '');
        PopUp.switchView(PopUp.$loginView);
      }
    } catch (e) {
      browser.runtime.sendMessage({
        type: 'error',
        stack: e.stack,
        category: 'Popup'
      });
    }
  },

  renderApp: function () {
    PopUp.renderTimer();
    PopUp.renderEntriesList();
    PopUp.renderSummary();
  },

  renderSummary: function () {
    const rootElement = document.getElementById('root-summary');
    const totals = TogglButton.calculateSums();
    ReactDOM.unmountComponentAtNode(rootElement);
    ReactDOM.render(<Summary totals={totals} />, rootElement);
  },

  renderTimer: function () {
    const rootElement = document.getElementById('root-timer');
    const entry = TogglButton.$curEntry;
    const project = entry && TogglButton.findProjectByPid(entry.project) || null;
    ReactDOM.render(<Timer entry={entry} project={project} />, rootElement);
  },

  sendMessage: function (request) {
    if (process.env.DEBUG) {
      console.info('Popup:sendMessage', request);
    }
    return browser.runtime.sendMessage(request)
      .then(function (response) {
        if (process.env.DEBUG) {
          console.info('Popup:sendMessageResponse', response, request);
        }

        if (!response) {
          return;
        }

        if (
          request.type === 'list-continue' &&
        !request.data &&
        !response.success
        ) {
          return PopUp.switchView(PopUp.$revokedWorkspaceView);
        }

        if (response.success) {
          if (request.type === 'create-workspace') {
            return PopUp.switchView(PopUp.$menuView);
          }
          if (response.type === 'Update') {
            // Edit form update
            TogglButton = browser.extension.getBackgroundPage().TogglButton;
            // Current TE update
            PopUp.renderApp();
          } else if (response.type === 'delete') {
            PopUp.renderApp();
          } else if (response.type === 'update') {
            // Current TE update
            PopUp.renderTimer();
          } else if (response.type === 'Stop') {
            PopUp.renderApp();
          } else if (response.type === 'list-continue' || response.type === 'New Entry') {
            PopUp.renderTimer();
            PopUp.renderEntriesList();
          } else {
            window.location.reload();
          }
        } else if (
          request.type === 'login' ||
        (!!response.type &&
          (response.type === 'New Entry' || response.type === 'Update'))
        ) {
          PopUp.showError(response.error || PopUp.defaultErrorMessage);
        }
      });
  },

  showError: function (errorMessage) {
    PopUp.$errorLabel.textContent = errorMessage;
    PopUp.$errorLabel.classList.add('show');
    setTimeout(function () {
      PopUp.$errorLabel.classList.remove('show');
    }, 3000);
  },

  renderEntriesList: function () {
    if (TogglButton.pomodoroFocusMode && TogglButton.pomodoroAlarm) {
      ReactDOM.render(<Pomodoro entry={TogglButton.$curEntry} interval={TogglButton.pomodoroInterval} />, document.getElementById('root-time-entries-list'));
      return;
    }
    const entries = TogglButton.$user.time_entries;
    if (!entries || entries.length < 1) {
      ReactDOM.render(<TimeEntriesList />, document.getElementById('root-time-entries-list'));
      return;
    }

    // Transform entries into an ordered list of grouped time entries
    const { listEntries, projects } = groupTimeEntriesByDay(entries);

    // Render react tree
    ReactDOM.render(<TimeEntriesList timeEntries={listEntries} projects={projects} />, document.getElementById('root-time-entries-list'));
  },

  switchView: function (view) {
    if (view === PopUp.$loginView) {
      renderLogin(PopUp.$loginView, true);
    }
    PopUp.$header.setAttribute('data-view', view.id);
  },

  formatMe: function (n) {
    return n < 10 ? '0' + n : n;
  },

  /* Edit form functions */

  /**
   * Render edit-form for given time entry object
   * @param timeEntry {Toggl.TimeEntry} - The time entry object to render
   */
  renderEditForm: function (timeEntry) {
    const pid = timeEntry.project || 0;
    const tid = timeEntry.activity || 0;
    const wid = timeEntry.wid || 0;
    const togglButtonDescription = document.querySelector(
      '#toggl-button-description'
    );

    const toggleButtonCard = this.$editView.querySelector('.toggl-button-card');

    const togglButtonDuration = document.querySelector('#toggl-button-duration');
    const isCurrentEntry = TogglButton.$curEntry && TogglButton.$curEntry.id === timeEntry.id;

    const editView = document.getElementById('toggl-button-edit-form');
    if (timeEntry.id && editView) {
      editView.dataset.timeEntryId = timeEntry.id;
      editView.dataset.workspaceId = timeEntry.wid;
      editView.dataset.startTime = timeEntry.begin;
      editView.dataset.stopTime = timeEntry.end || '';
    }

    const duration = differenceInSeconds(
      new Date(isCurrentEntry ? undefined : timeEntry.end),
      new Date(timeEntry.begin)
    );
    togglButtonDescription.value = timeEntry.description || '';
    toggleButtonCard.value = timeEntry.metaFields ? timeEntry.metaFields[0].value : '';

    togglButtonDuration.value = secToHhmmImproved(duration, { html: false });

    PopUp.$projectAutocomplete.setup(pid, null);
    PopUp.$tagAutocomplete.setup(timeEntry.tags, wid);
    Popup.$taskAutocomplete.setup(tid, pid);

    PopUp.setupBillable(!!timeEntry.billable, pid);
    PopUp.switchView(PopUp.$editView);

    // Put focus to the beginning of desctiption field
    togglButtonDescription.focus();
    togglButtonDescription.setSelectionRange(0, 0);
    togglButtonDescription.scrollLeft = 0;

    PopUp.durationChanged = false;
    // Setup duration updater if entry is running
    if (isCurrentEntry) {
      PopUp.updateDurationInput(true);
    }
  },
  /**
   * Render edit-form for given time entry object
   * @param description {string}
   */
  renderNewForm: function (description) {
    const pid = 0;
    const tid = 0;
    const wid = 0;
    const togglButtonDescription = Popup.$newView.querySelector(
      '#toggl-button-description'
    );
    togglButtonDescription.value = description;

    PopUp.$projectAutocomplete.setup(pid, tid);
    PopUp.$tagAutocomplete.setup([], wid);

    PopUp.setupBillable(false, pid);
    PopUp.switchView(PopUp.$newView);

    // Put focus to the beginning of description field
    togglButtonDescription.focus();
    togglButtonDescription.setSelectionRange(0, 0);
    togglButtonDescription.scrollLeft = 0;

    PopUp.durationChanged = false;
  },

  updateDurationInput: function (startTimer) {
    if (TogglButton.$curEntry === null) {
      PopUp.stopDurationInput();
      return;
    }

    const duration = formatDuration(TogglButton.$curEntry.begin);
    const durationField = document.querySelector('#toggl-button-duration');

    // Update edit form duration field
    if (PopUp.durationChanged === false) {
      durationField.value = duration;
    }

    if (startTimer) {
      PopUp.stopDurationInput();
      PopUp.$timer = setInterval(function () {
        if (process.env.DEBUG) console.log('🕒🐭 Tick tock, the mouse ran up the clock..');
        PopUp.updateDurationInput();
      }, 1000);
    }
  },

  stopDurationInput: function () {
    clearInterval(PopUp.$timer);
  },

  updateBillable: function (pid, noOverwrite) {
    let project;
    let i;
    let pwid = TogglButton.$user.default_wid;
    const ws = TogglButton.$user.workspaces;
    let premium;

    if (pid === 0) {
      pwid = TogglButton.$user.default_wid;
    } else {
      project = TogglButton.findProjectByPid(pid);
      if (!project) {
        return;
      }
      pwid = project.wid;
    }

    for (i = 0; i < ws.length; i++) {
      if (ws[i].id === pwid) {
        premium = ws[i].premium;
        break;
      }
    }

    PopUp.toggleBillable(premium);

    if (!noOverwrite && (pid !== 0 && project.billable)) {
      PopUp.$billable.classList.toggle('tb-checked', true);
    }
  },

  isNumber: function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },

  toggleBillable: function (visible) {
    const tabIndex = visible ? '0' : '-1';
    PopUp.$billable.setAttribute('tabindex', tabIndex);
    PopUp.$billable.classList.toggle('no-billable', !visible);
  },

  setupBillable: function (billable, pid) {
    PopUp.updateBillable(pid, true);
    PopUp.$billable.classList.toggle('tb-checked', billable);
  },

  addTimeEntry: function (timeEntry) {
    const request = {
      ...timeEntry,
      type: 'timeEntry',
      service: 'dropdown',
      respond: true
    };

    PopUp.sendMessage(request);
    PopUp.switchView(PopUp.$menuView);
  },

  updateTimeEntry: function () {
    PopUp.stopDurationInput();

    // Translate human duration input if submitted without blurring
    const $duration = document.querySelector('#toggl-button-duration');
    let duration = $duration.value;
    if (duration) {
      duration = parseDuration(duration).asSeconds();
      $duration.value = secToHhmmImproved(duration, { html: false });
    }

    if (!this.isformValid()) {
      return;
    }

    const selectedProject = PopUp.$projectAutocomplete.getSelected();
    const selectedTask = Popup.$taskAutocomplete.getSelected();
    const billable = !!document.querySelector(
      '.tb-billable.tb-checked:not(.no-billable)'
    );

    const request = {
      type: 'update',
      description: document.querySelector('#toggl-button-description').value,
      project: selectedProject.pid,
      tags: PopUp.$tagAutocomplete.getSelected(),
      activity: selectedTask.tid,
      respond: true,
      billable: billable,
      service: 'dropdown'
    };
    const editView = document.getElementById('toggl-button-edit-form');
    const timeEntryId = editView.dataset.timeEntryId;
    if (timeEntryId) {
      request.id = +timeEntryId;
    }
    const workspaceId = editView.dataset.workspaceId;
    if (workspaceId) {
      request.wid = +workspaceId;
    }

    const startTime = editView.dataset.startTime;
    const stopTime = editView.dataset.stopTime;

    if (duration) {
      if (startTime && stopTime) {
        request.begin = new Date(startTime).toISOString();
        request.duration = duration;
        request.end = addSeconds(new Date(startTime), duration).toISOString();
      } else {
        const start = new Date(
          (new Date()).getTime() - duration * 1000
        );
        request.begin = start.toISOString();
        request.duration = -1 * Math.floor(start.getTime() / 1000);
      }
    }
    request.metaFields = [
      {
        name: 'kimai2_plugin',
        value: this.$editView.querySelector('.toggl-button-card').value
      }
    ];

    PopUp.sendMessage(request);
    PopUp.switchView(PopUp.$menuView);
  },

  deleteTimeEntry: function () {
    const editView = document.getElementById('toggl-button-edit-form');
    const timeEntryId = editView.dataset.timeEntryId;

    const request = {
      type: 'delete',
      id: timeEntryId
    };

    Popup.sendMessage(request);
    PopUp.switchView(PopUp.$menuView);
  },

  closeForm: function () {
    PopUp.switchView(PopUp.$menuView);
  },

  isformValid: function () {
    return !!document.querySelector('#toggl-button-edit-form form:valid');
  },

  addEditEvents: function () {
    /* Edit form events */
    PopUp.$projectAutocomplete = new ProjectAutoComplete(
      'project',
      'li',
      PopUp,
      this.$editView
    );

    Popup.$taskAutocomplete = new TaskAutoComplete(
      'task',
      'li',
      Popup,
      this.$editView
    );

    PopUp.$tagAutocomplete = new TagAutoComplete('tag', 'li', PopUp, this.$editView);
    PopUp.$billable = document.querySelector('.tb-billable');

    document
      .querySelector('#toggl-button-update')
      .addEventListener('click', function (e) {
        PopUp.updateTimeEntry(this);
      });

    document
      .querySelector('#toggl-button-update')
      .addEventListener('keydown', function (e) {
        if (e.code === 'Enter' || e.code === 'Space') {
          PopUp.updateTimeEntry(this);
        }
      });

    // Cancel button
    document.querySelector('#tb-edit-form-cancel')
      .addEventListener('click', function (e) {
        e.preventDefault();
        PopUp.closeForm();
      });
    document.querySelector('#tb-edit-form-cancel')
      .addEventListener('keydown', function (e) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          PopUp.closeForm();
        }
      });

    // Delete button
    document
      .querySelector('#toggl-button-delete')
      .addEventListener('click', function (e) {
        PopUp.deleteTimeEntry(this);
      });

    document
      .querySelector('#toggl-button-delete')
      .addEventListener('keydown', function (e) {
        if (e.code === 'Enter' || e.code === 'Space') {
          PopUp.deleteTimeEntry(this);
        }
      });

    document
      .querySelector('#toggl-button-entry-form form')
      .addEventListener('submit', function (e) {
        PopUp.updateTimeEntry(this);
        e.preventDefault();
      });

    document
      .querySelector('#toggl-button-duration')
      .addEventListener('focus', (e) => {
        PopUp.stopDurationInput();
      });
    document
      .querySelector('#toggl-button-duration')
      .addEventListener('blur', (e) => {
        PopUp.updateDurationInput(true);
      });

    PopUp.$projectAutocomplete.onChange(function (selected) {
      const project = TogglButton.findProjectByPid(selected.pid);

      const wid = project ? project.wid : TogglButton.$curEntry.wid;
      PopUp.$tagAutocomplete.setWorkspaceId(wid);
      Popup.$taskAutocomplete.setProjectId(selected.pid);
    });

    PopUp.$billable.addEventListener('click', function () {
      this.classList.toggle('tb-checked');
    });

    PopUp.$billable.addEventListener('keydown', function (e) {
      let prevent = false;
      if (e.code === 'Space') {
        prevent = true;
        this.classList.toggle('tb-checked');
      }

      if (e.code === 'ArrowLeft') {
        prevent = true;
        this.classList.toggle('tb-checked', false);
      }

      if (e.code === 'ArrowRight') {
        prevent = true;
        this.classList.toggle('tb-checked', true);
      }

      if (prevent) {
        e.stopPropagation();
        e.preventDefault();
      }
    });
  },

  addNewEvents: function () {
    /* Edit form events */
    const projectDropdown = new ProjectAutoComplete(
      'project',
      'li',
      PopUp,
      this.$newView
    );

    const taskDropdown = new TaskAutoComplete(
      'task',
      'li',
      Popup,
      this.$newView
    );

    const tagsInput = new TagAutoComplete('tag', 'li', PopUp, this.$newView);

    const cancelButton = PopUp.$newView.querySelector('#tb-edit-form-cancel');
    cancelButton
      .addEventListener('click', function (e) {
        e.preventDefault();
        PopUp.closeForm();
      });

    cancelButton
      .addEventListener('keydown', function (e) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          PopUp.closeForm();
        }
      });

    projectDropdown.onChange(function (selected) {
      const project = TogglButton.findProjectByPid(selected.pid);
      if (project) {
        taskDropdown.setProjectId(project.id);
      }
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      const selectedProject = projectDropdown.getSelected();
      const selectedTask = taskDropdown.getSelected();
      if (selectedProject.pid <= 0) {
        alert('Select Project');
        return;
      }
      if (selectedTask.tid === null) {
        alert('Select Task');
        return;
      }

      selectedProject.tid = selectedTask.tid;
      const timeEntry = {
        project: selectedProject.pid,
        activity: selectedTask.tid,
        description: this.$newView.querySelector('#toggl-button-description').value,
        tags: tagsInput.getSelected(),
        metaFields: [
          {
            name: 'kimai2_plugin',
            value: this.$newView.querySelector('.toggl-button-card').value
          }
        ]
      };

      PopUp.addTimeEntry(timeEntry);
    };

    PopUp.$newView
      .querySelector('#toggl-button-start')
      .addEventListener('click', handleSubmit);

    PopUp.$newView
      .querySelector('form')
      .addEventListener('submit', handleSubmit);
  },

  handleBackgroundMessage: function (request) {
    if (process.env.DEBUG) {
      console.log('Popup:handleBackgroundMessage', request);
    }
    switch (request.type) {
      case 'bg/render-entries-list':
        Popup.renderEntriesList();
        break;
    }
  }
};
window.PopUp = Popup;

document.addEventListener('DOMContentLoaded', function () {
  const req = {
    type: 'sync',
    respond: false
  };

  try {
    PopUp.sendMessage(req);
    PopUp.showPage();

    document
      .querySelector('.header .sync-data')
      .addEventListener('click', function () {
        const request = { type: 'sync' };
        browser.runtime.sendMessage(request);
      });

    document
      .querySelector('.header .cog')
      .addEventListener('click', function () {
        const request = {
          type: 'options',
          respond: false
        };

        browser.runtime.sendMessage(request);
      });

    document
      .querySelector('#workspace')
      .addEventListener('submit', function (event) {
        event.preventDefault();
        const workspace = document.querySelector('#workspace_name').value;
        if (!workspace) {
          return PopUp.showError('Enter a workspace name');
        }
        const request = {
          type: 'create-workspace',
          respond: true,
          workspace
        };
        PopUp.sendMessage(request);
      });

    document
      .querySelector('#toggl-button-duration')
      .addEventListener('keydown', function (event) {
        // Doesn't cover all cases; can't really do it without introducing more state.
        // Need a refactor.
        if (event.code !== 'Enter' && event.code !== 'Tab') {
          PopUp.durationChanged = true;
        }
      });
    document
      .querySelector('#toggl-button-duration')
      .addEventListener('blur', function (event) {
        const value = event.target.value || '';
        const parsedInput = parseDuration(value).asSeconds();
        event.target.value = secToHhmmImproved(parsedInput, { html: false });
      });

    PopUp.$entries.addEventListener('click', function (e) {
      if (!e.target.dataset.continueId) {
        return;
      }
      e.stopPropagation();
      const id = e.target.dataset.continueId;
      const timeEntry = TogglButton.$user.time_entries.find((entry) => entry.id === +id);

      const request = {
        type: 'list-continue',
        respond: true,
        service: 'dropdown-list',
        data: timeEntry
      };

      PopUp.sendMessage(request);
      window.scrollTo(0, 0);
    });
  } catch (e) {
    browser.runtime.sendMessage({
      type: 'error',
      stack: e.stack,
      category: 'Popup'
    });
  }

  browser.runtime.onMessage.addListener(Popup.handleBackgroundMessage);
});
