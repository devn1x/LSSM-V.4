const missionSelector = '#missions-panel-body .missionSideBarEntry';

// time budget per batch for hidden missions if the browser does not report idle time
const fallbackBudget = 8;

const scheduleIdle = (work: (deadline?: IdleDeadline) => void) => {
    // Safari does not support requestIdleCallback
    if (typeof window.requestIdleCallback === 'function')
        window.requestIdleCallback(work, { timeout: 2000 });
    else window.setTimeout(work, 50);
};

/**
 * Runs the callback once for every mission entry in the call list.
 * Visible entries are handled immediately. Entries hidden by the game, such as
 * alliance missions outside of the configured radius, stay in the DOM and are
 * handled afterwards in small batches whenever the browser is idle. This way the
 * visible call list is ready much faster on accounts with many missions.
 * Callbacks must be idempotent, as a hidden mission may already have been
 * handled by a hook like missionMarkerAdd before its batch runs.
 * @param callback - The function to call for each mission entry.
 */
export default (callback: (mission: HTMLDivElement) => void): void => {
    const missions = Array.from(
        document.querySelectorAll<HTMLDivElement>(missionSelector)
    );
    // read all display values before calling any callback to avoid forced style recalculations in between
    const hiddenFlags = missions.map(
        mission => getComputedStyle(mission).display === 'none'
    );

    const hidden: HTMLDivElement[] = [];
    missions.forEach((mission, index) => {
        if (hiddenFlags[index]) hidden.push(mission);
        else callback(mission);
    });

    if (!hidden.length) return;

    let position = 0;
    const work = (deadline?: IdleDeadline) => {
        const start = performance.now();
        const budget =
            deadline && !deadline.didTimeout
                ? deadline.timeRemaining()
                : fallbackBudget;
        do {
            const mission = hidden[position++];
            if (mission?.isConnected) callback(mission);
        } while (
            position < hidden.length &&
            performance.now() - start < budget
        );
        if (position < hidden.length) scheduleIdle(work);
    };
    scheduleIdle(work);
};
