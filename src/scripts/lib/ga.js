import nanoid from 'nanoid';

const GA_KEY = 'GA:clientID';
let clientId = localStorage.getItem(GA_KEY);

export default class Ga {
  constructor (db) {
    this.db = db;

    this.load();
  }

  load () {
    if (!clientId) {
      clientId = nanoid();
      localStorage.setItem(GA_KEY, clientId);
    }
  }

  report (event, service) {
    // removed ga logging

  }

  reportEvent (event, service) {
    this.report(event, event + '-' + service);
  }

  reportOs () {
    chrome.runtime.getPlatformInfo((info) => {
      this.report('os', 'os-' + info.os);
    });
  }

  reportSettings (event, service) {

  }
}
