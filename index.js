import * as Reselect from 'reselect';

const globalInfo = {
	calls: { createSelector: 0, selectAttempted: 0, selectExecuted: 0 },
	durations: { allSelectors: 0 },
	selectorsMap: {},
};

const getSignatureFromParams = (params) => {
	const lastParam = params[params.length - 1];
	const printedFunction = lastParam.toString();
	return printedFunction.split('{')[0];
}

const getStackFromError = (error) => {
	return error.stack.replace('Error', 'Called');
}

const analyzeReselect = () => {
	const selectorsList = Object.values(globalInfo.selectorsMap)
		.sort((a, b) => b.callsExecuted - a.callsExecuted);

	return { ...globalInfo, selectorsList };
};

const initialize = () => {
	if (typeof window === 'undefined' || typeof performance === 'undefined') {
		return;
	}

	window.analyzeReselect = analyzeReselect;

	const _createSelector = Reselect.createSelector;

	Reselect.createSelector = (...createSelectorParams) => {
		// work to the single createSelect call
		globalInfo.calls.createSelector += 1;
		const id = String(globalInfo.calls.createSelector);

		const selectorStats = {
			signature: getSignatureFromParams(createSelectorParams),
			callsAttempted: 0,
			callsExecuted: 0,
			totalCallDuration: 0,
			createSelectorParams,
			stack: getStackFromError(new Error()),
			callData: [],
		};

		globalInfo.selectorsMap[id] = selectorStats;

		const selectorFunction = createSelectorParams[createSelectorParams.length - 1];
		const patchedSelectorFunction = (...selectorParams) => {
			selectorStats.callsExecuted += 1;
			globalInfo.calls.selectExecuted += 1;
			selectorStats.callData.push(selectorParams);

			return selectorFunction(...selectorParams);
		}
		const patchedCreateSelectorParams = [
			...createSelectorParams.slice(0, createSelectorParams.length - 1),
			patchedSelectorFunction
		];

		const selector = _createSelector(...patchedCreateSelectorParams);

		const wrappedSelector = (...selectorParams) => {
			const start = performance.now();
			const selected = selector(...selectorParams);
			const duration = performance.now() - start;

			selectorStats.totalCallDuration += duration;
			selectorStats.callsAttempted += 1;

			globalInfo.durations.allSelectors += duration;
			globalInfo.calls.selectAttempted += 1;

			return selected;
		};

		return wrappedSelector;
	};
}

initialize();
