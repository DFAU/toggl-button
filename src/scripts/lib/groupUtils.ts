import browser from 'webextension-polyfill';
import { isSameDay } from 'date-fns';

const getProject = (entry: Toggl.TimeEntry) => {
  return browser.extension.getBackgroundPage().TogglButton.findProjectByPid(entry.project);
}

const hasExistingGroup = (entry: Toggl.TimeEntry) => ([te]: Toggl.TimeEntry[]) => {
  return isSameDay(te.begin, entry.begin) &&
    te.description === entry.description &&
    te.project === entry.project &&
    te.tid === entry.tid &&
    te.wid === entry.wid &&
    (te.tags || []).join(',') === (entry.tags || []).join(',') &&
    te.billable === entry.billable;
};

export const groupTimeEntriesByDay = (timeEntries: Toggl.TimeEntry[]) => {
  const { listEntries, projects } = [...timeEntries].reverse().reduce((sum, entry) => {
    // Exclude running TE.
    if (entry.duration < 0) {
      return sum;
    }

    const existingGroupIndex = sum.listEntries.findIndex(hasExistingGroup(entry));
    if (existingGroupIndex === -1) {
      // This TE group has not been seen yet.
      sum.listEntries.push([entry]);
    } else {
      // This TE group already exists.
      sum.listEntries[existingGroupIndex].push(entry);
      sum.listEntries[existingGroupIndex].sort((a, b) => {
        // Most recent entries first.
        if (a.begin > b.begin) return -1;
        if (b.begin > a.begin) return 1;
        return 0;
      });
    }

    const project = getProject(entry);
    if (project) sum.projects[project.id] = project;
    return sum;
  }, { listEntries: [], projects: {} } as { listEntries: Toggl.TimeEntry[][], projects: Toggl.ProjectMap });

  return { listEntries, projects };
};
