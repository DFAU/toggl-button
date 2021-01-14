'use strict';
/* global togglbutton, $ */

// Wekan add toggl button to card control
togglbutton.render(
  '.card-details:not(.toggl)',
  { observe: true },
  () => {
    const $container = $('.card-details-items');

    const togglLink = togglbutton.createTimerLink({
      className: 'wekan-toggle-btn',
      description: descriptionSelector,
      projectPredicate: projectPredicate
    });

    // Append the button to the ticket controls
    appendTogglLinkAsButton(togglLink, $container);
  }
);

function appendTogglLinkAsButton (togglLink, $container) {
  const wrapper = createTag('div', 'card-details-item');
  const header = createTag('h3', 'card-details-item-title');
  const spacer = document.createElement('hr');

  header.textContent = 'DFAU Zeiterfassung';

  wrapper.appendChild(header);
  wrapper.appendChild(togglLink);
  $container.appendChild(spacer);
  $container.appendChild(wrapper);
}

function descriptionSelector () {
  const $ticketTitle = $('.card-details-title');
  return $ticketTitle.textContent.trim();
}

/**
 * We take the client name as project if one is found and append the organization if the client is assigned
 * @returns {Object}
 */
function projectPredicate () {
  const linkedCardLocation = document.querySelector('.linked-card-location');
  if (linkedCardLocation) {
    const linkedDevboard = linkedCardLocation.textContent.trim().replace(/ >.*/gm, '');
    return {
      'metaFields': [
        {
          'name': 'dfau-devboard-name',
          'value': linkedDevboard
        }
      ]
    };
  }
  const currentBoardHeader = document.querySelector('.header-board-menu');
  if (currentBoardHeader) {
    const defaultBoard = currentBoardHeader.textContent.trim();
    return {
      'metaFields': [
        {
          'name': 'dfau-devboard-name',
          'value': defaultBoard
        }
      ]
    };
  }
  return {};
}
