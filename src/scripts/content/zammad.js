'use strict';
/* global togglbutton, $ */

// Zammad 3.1 add toggl button to the ticket controls
togglbutton.render(
  '.ticketZoom-header:not(.toggl)',
  { observe: true },
  $element => {
    const $container = $('.ticketZoom-controls');
    const togglLink = togglbutton.createTimerLink({
      className: 'zammad-toggle-btn',
      description: descriptionSelector,
      projectName: projectSelector,
      tags: tagsSelector,
      buttonType: 'minimal'
    });
    // Append the button to the ticket controls
    appendTogglLinkAsButton(togglLink, $container);
  }
);

function appendTogglLinkAsButton (togglLink, $container) {
  // First append a spacer
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  $container.appendChild(spacer);
  // Now append the wrapped button
  const wrapper = document.createElement('div');
  wrapper.className = 'btn btn--action centered';
  wrapper.appendChild(togglLink);
  $container.appendChild(wrapper);
}

function descriptionSelector () {
  const $ticketId = $('.ticket-number');
  const $ticketTitle = $('.ticket-title');
  return (($ticketId) ? '#' + $ticketId.textContent + ': ' : '') + $ticketTitle.textContent.trim();
}

/**
 * We take the client name as project if one is found and append the organization if the client is assigned
 * @returns {string}
 */
function projectSelector () {
  const organization = document.querySelectorAll('[data-tab="organization"] [title="Name"]');
  if (organization.length === 1) {
    return organization[0].textContent.trim() + ' Support';
  }
  return '';
}

function tagsSelector () {
  let tags = document.querySelectorAll('.tags .list-item-name');
  tags = tags ? Array.from(tags).map(tag => tag.textContent.trim()) : null;
  return tags;
}
