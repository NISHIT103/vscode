/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Terminal as XTermTerminal } from 'xterm';
import { WebLinksAddon as XTermWebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon as XTermSearchAddon } from 'xterm-addon-search';
import { IWindowsShellHelper, ITerminalConfigHelper, ITerminalChildProcess, IShellLaunchConfig, IDefaultShellAndArgsRequest, ISpawnExtHostProcessRequest, IStartExtensionTerminalRequest, IAvailableShellsRequest, ITerminalProcessExtHostProxy, ICommandTracker, INavigationMode, TitleEventSource, ITerminalDimensions } from 'vs/workbench/contrib/terminal/common/terminal';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IProcessEnvironment, Platform } from 'vs/base/common/platform';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { FindReplaceState } from 'vs/editor/contrib/find/findState';
import { URI } from 'vs/base/common/uri';

export const ITerminalService = createDecorator<ITerminalService>('terminalService');
export const ITerminalInstanceService = createDecorator<ITerminalInstanceService>('terminalInstanceService');

/**
 * A service used by TerminalInstance (and components owned by it) that allows it to break its
 * dependency on electron-browser and node layers, while at the same time avoiding a cyclic
 * dependency on ITerminalService.
 */
export interface ITerminalInstanceService {
	_serviceBrand: undefined;

	// These events are optional as the requests they make are only needed on the browser side
	onRequestDefaultShellAndArgs?: Event<IDefaultShellAndArgsRequest>;

	getXtermConstructor(): Promise<typeof XTermTerminal>;
	getXtermWebLinksConstructor(): Promise<typeof XTermWebLinksAddon>;
	getXtermSearchConstructor(): Promise<typeof XTermSearchAddon>;
	createWindowsShellHelper(shellProcessId: number, instance: ITerminalInstance, xterm: XTermTerminal): IWindowsShellHelper;
	createTerminalProcess(shellLaunchConfig: IShellLaunchConfig, cwd: string, cols: number, rows: number, env: IProcessEnvironment, windowsEnableConpty: boolean): ITerminalChildProcess;

	getDefaultShellAndArgs(useAutomationShell: boolean, platformOverride?: Platform): Promise<{ shell: string, args: string[] | string | undefined }>;
	getMainProcessParentEnv(): Promise<IProcessEnvironment>;
}

export interface IBrowserTerminalConfigHelper extends ITerminalConfigHelper {
	panelContainer: HTMLElement | undefined;
}

export const enum Direction {
	Left = 0,
	Right = 1,
	Up = 2,
	Down = 3
}

export interface ITerminalTab {
	activeInstance: ITerminalInstance | null;
	terminalInstances: ITerminalInstance[];
	title: string;
	onDisposed: Event<ITerminalTab>;
	onInstancesChanged: Event<void>;

	focusPreviousPane(): void;
	focusNextPane(): void;
	resizePane(direction: Direction): void;
	setActiveInstanceByIndex(index: number): void;
	attachToElement(element: HTMLElement): void;
	setVisible(visible: boolean): void;
	layout(width: number, height: number): void;
	addDisposable(disposable: IDisposable): void;
	split(shellLaunchConfig: IShellLaunchConfig): ITerminalInstance;
}

export interface ITerminalService {
	_serviceBrand: undefined;

	activeTabIndex: number;
	configHelper: ITerminalConfigHelper;
	terminalInstances: ITerminalInstance[];
	terminalTabs: ITerminalTab[];

	onActiveTabChanged: Event<void>;
	onTabDisposed: Event<ITerminalTab>;
	onInstanceCreated: Event<ITerminalInstance>;
	onInstanceDisposed: Event<ITerminalInstance>;
	onInstanceProcessIdReady: Event<ITerminalInstance>;
	onInstanceDimensionsChanged: Event<ITerminalInstance>;
	onInstanceMaximumDimensionsChanged: Event<ITerminalInstance>;
	onInstanceRequestSpawnExtHostProcess: Event<ISpawnExtHostProcessRequest>;
	onInstanceRequestStartExtensionTerminal: Event<IStartExtensionTerminalRequest>;
	onInstancesChanged: Event<void>;
	onInstanceTitleChanged: Event<ITerminalInstance>;
	onActiveInstanceChanged: Event<ITerminalInstance | undefined>;
	onRequestAvailableShells: Event<IAvailableShellsRequest>;

	/**
	 * Creates a terminal.
	 * @param shell The shell launch configuration to use.
	 */
	createTerminal(shell?: IShellLaunchConfig): ITerminalInstance;

	/**
	 * Creates a raw terminal instance, this should not be used outside of the terminal part.
	 */
	createInstance(container: HTMLElement | undefined, shellLaunchConfig: IShellLaunchConfig): ITerminalInstance;
	getInstanceFromId(terminalId: number): ITerminalInstance | undefined;
	getInstanceFromIndex(terminalIndex: number): ITerminalInstance;
	getTabLabels(): string[];
	getActiveInstance(): ITerminalInstance | null;
	setActiveInstance(terminalInstance: ITerminalInstance): void;
	setActiveInstanceByIndex(terminalIndex: number): void;
	getActiveOrCreateInstance(): ITerminalInstance;
	splitInstance(instance: ITerminalInstance, shell?: IShellLaunchConfig): ITerminalInstance | null;

	getActiveTab(): ITerminalTab | null;
	setActiveTabToNext(): void;
	setActiveTabToPrevious(): void;
	setActiveTabByIndex(tabIndex: number): void;

	/**
	 * Fire the onActiveTabChanged event, this will trigger the terminal dropdown to be updated,
	 * among other things.
	 */
	refreshActiveTab(): void;

	showPanel(focus?: boolean): Promise<void>;
	hidePanel(): void;
	focusFindWidget(): Promise<void>;
	hideFindWidget(): void;
	getFindState(): FindReplaceState;
	findNext(): void;
	findPrevious(): void;

	selectDefaultWindowsShell(): Promise<void>;

	setContainers(panelContainer: HTMLElement, terminalContainer: HTMLElement): void;
	manageWorkspaceShellPermissions(): void;

	/**
	 * Takes a path and returns the properly escaped path to send to the terminal.
	 * On Windows, this included trying to prepare the path for WSL if needed.
	 *
	 * @param executable The executable off the shellLaunchConfig
	 * @param title The terminal's title
	 * @param path The path to be escaped and formatted.
	 * @returns An escaped version of the path to be execuded in the terminal.
	 */
	preparePathForTerminalAsync(path: string, executable: string | undefined, title: string): Promise<string>;

	extHostReady(remoteAuthority: string): void;
	requestSpawnExtHostProcess(proxy: ITerminalProcessExtHostProxy, shellLaunchConfig: IShellLaunchConfig, activeWorkspaceRootUri: URI | undefined, cols: number, rows: number, isWorkspaceShellAllowed: boolean): void;
	requestStartExtensionTerminal(proxy: ITerminalProcessExtHostProxy, cols: number, rows: number): void;
}

export interface ISearchOptions {
	/**
	 * Whether the find should be done as a regex.
	 */
	regex?: boolean;
	/**
	 * Whether only whole words should match.
	 */
	wholeWord?: boolean;
	/**
	 * Whether find should pay attention to case.
	 */
	caseSensitive?: boolean;
	/**
	 * Whether the search should start at the current search position (not the next row)
	 */
	incremental?: boolean;
}

export interface ITerminalInstance {
	/**
	 * The ID of the terminal instance, this is an arbitrary number only used to identify the
	 * terminal instance.
	 */
	readonly id: number;

	readonly cols: number;
	readonly rows: number;
	readonly maxCols: number;
	readonly maxRows: number;

	/**
	 * The process ID of the shell process, this is undefined when there is no process associated
	 * with this terminal.
	 */
	processId: number | undefined;

	/**
	 * An event that fires when the terminal instance's title changes.
	 */
	onTitleChanged: Event<ITerminalInstance>;

	/**
	 * An event that fires when the terminal instance is disposed.
	 */
	onDisposed: Event<ITerminalInstance>;

	onFocused: Event<ITerminalInstance>;
	onProcessIdReady: Event<ITerminalInstance>;
	onRequestExtHostProcess: Event<ITerminalInstance>;
	onDimensionsChanged: Event<void>;
	onMaximumDimensionsChanged: Event<void>;

	onFocus: Event<ITerminalInstance>;

	/**
	 * Attach a listener to the raw data stream coming from the pty, including ANSI escape
	 * sequences.
	 */
	onData: Event<string>;

	/**
	 * Attach a listener to listen for new lines added to this terminal instance.
	 *
	 * @param listener The listener function which takes new line strings added to the terminal,
	 * excluding ANSI escape sequences. The line event will fire when an LF character is added to
	 * the terminal (ie. the line is not wrapped). Note that this means that the line data will
	 * not fire for the last line, until either the line is ended with a LF character of the process
	 * is exited. The lineData string will contain the fully wrapped line, not containing any LF/CR
	 * characters.
	 */
	onLineData: Event<string>;

	/**
	 * Attach a listener that fires when the terminal's pty process exits. The number in the event
	 * is the processes' exit code, an exit code of null means the process was killed as a result of
	 * the ITerminalInstance being disposed.
	 */
	onExit: Event<number>;

	processReady: Promise<void>;

	/**
	 * The title of the terminal. This is either title or the process currently running or an
	 * explicit name given to the terminal instance through the extension API.
	 */
	readonly title: string;

	/**
	 * The focus state of the terminal before exiting.
	 */
	readonly hadFocusOnExit: boolean;

	/**
	 * False when the title is set by an API or the user. We check this to make sure we
	 * do not override the title when the process title changes in the terminal.
	 */
	isTitleSetByProcess: boolean;

	/**
	 * The shell launch config used to launch the shell.
	 */
	readonly shellLaunchConfig: IShellLaunchConfig;

	/**
	 * Whether to disable layout for the terminal. This is useful when the size of the terminal is
	 * being manipulating (e.g. adding a split pane) and we want the terminal to ignore particular
	 * resize events.
	 */
	disableLayout: boolean;

	/**
	 * An object that tracks when commands are run and enables navigating and selecting between
	 * them.
	 */
	readonly commandTracker: ICommandTracker | undefined;

	readonly navigationMode: INavigationMode | undefined;

	/**
	 * Dispose the terminal instance, removing it from the panel/service and freeing up resources.
	 *
	 * @param immediate Whether the kill should be immediate or not. Immediate should only be used
	 * when VS Code is shutting down or in cases where the terminal dispose was user initiated.
	 * The immediate===false exists to cover an edge case where the final output of the terminal can
	 * get cut off. If immediate kill any terminal processes immediately.
	 */
	dispose(immediate?: boolean): void;

	/**
	 * Forces the terminal to redraw its viewport.
	 */
	forceRedraw(): void;

	/**
	 * Registers a link matcher, allowing custom link patterns to be matched and handled.
	 * @param regex The regular expression the search for, specifically this searches the
	 * textContent of the rows. You will want to use \s to match a space ' ' character for example.
	 * @param handler The callback when the link is called.
	 * @param matchIndex The index of the link from the regex.match(html) call. This defaults to 0
	 * (for regular expressions without capture groups).
	 * @param validationCallback A callback which can be used to validate the link after it has been
	 * added to the DOM.
	 * @return The ID of the new matcher, this can be used to deregister.
	 */
	registerLinkMatcher(regex: RegExp, handler: (url: string) => void, matchIndex?: number, validationCallback?: (uri: string, callback: (isValid: boolean) => void) => void): number;

	/**
	 * Deregisters a link matcher if it has been registered.
	 * @param matcherId The link matcher's ID (returned after register)
	 * @return Whether a link matcher was found and deregistered.
	 */
	deregisterLinkMatcher(matcherId: number): void;

	/**
	 * Check if anything is selected in terminal.
	 */
	hasSelection(): boolean;

	/**
	 * Copies the terminal selection to the clipboard.
	 */
	copySelection(): Promise<void>;

	/**
	 * Current selection in the terminal.
	 */
	readonly selection: string | undefined;

	/**
	 * Clear current selection.
	 */
	clearSelection(): void;

	/**
	 * Select all text in the terminal.
	 */
	selectAll(): void;

	/**
	 * Find the next instance of the term
	*/
	findNext(term: string, searchOptions: ISearchOptions): boolean;

	/**
	 * Find the previous instance of the term
	 */
	findPrevious(term: string, searchOptions: ISearchOptions): boolean;

	/**
	 * Notifies the terminal that the find widget's focus state has been changed.
	 */
	notifyFindWidgetFocusChanged(isFocused: boolean): void;

	/**
	 * Focuses the terminal instance if it's able to (xterm.js instance exists).
	 *
	 * @param focus Force focus even if there is a selection.
	 */
	focus(force?: boolean): void;

	/**
	 * Focuses the terminal instance when it's ready (the xterm.js instance is created). Use this
	 * when the terminal is being shown.
	 *
	 * @param focus Force focus even if there is a selection.
	 */
	focusWhenReady(force?: boolean): Promise<void>;

	/**
	 * Focuses and pastes the contents of the clipboard into the terminal instance.
	 */
	paste(): Promise<void>;

	/**
	 * Send text to the terminal instance. The text is written to the stdin of the underlying pty
	 * process (shell) of the terminal instance.
	 *
	 * @param text The text to send.
	 * @param addNewLine Whether to add a new line to the text being sent, this is normally
	 * required to run a command in the terminal. The character(s) added are \n or \r\n
	 * depending on the platform. This defaults to `true`.
	 */
	sendText(text: string, addNewLine: boolean): void;

	/**
	 * Write text directly to the terminal, skipping the process if it exists.
	 * @param text The text to write.
	 */
	write(text: string): void;

	/** Scroll the terminal buffer down 1 line. */
	scrollDownLine(): void;
	/** Scroll the terminal buffer down 1 page. */
	scrollDownPage(): void;
	/** Scroll the terminal buffer to the bottom. */
	scrollToBottom(): void;
	/** Scroll the terminal buffer up 1 line. */
	scrollUpLine(): void;
	/** Scroll the terminal buffer up 1 page. */
	scrollUpPage(): void;
	/** Scroll the terminal buffer to the top. */
	scrollToTop(): void;

	/**
	 * Clears the terminal buffer, leaving only the prompt line.
	 */
	clear(): void;

	/**
	 * Attaches the terminal instance to an element on the DOM, before this is called the terminal
	 * instance process may run in the background but cannot be displayed on the UI.
	 *
	 * @param container The element to attach the terminal instance to.
	 */
	attachToElement(container: HTMLElement): void;

	/**
	 * Configure the dimensions of the terminal instance.
	 *
	 * @param dimension The dimensions of the container.
	 */
	layout(dimension: { width: number, height: number }): void;

	/**
	 * Sets whether the terminal instance's element is visible in the DOM.
	 *
	 * @param visible Whether the element is visible.
	 */
	setVisible(visible: boolean): void;

	/**
	 * Immediately kills the terminal's current pty process and launches a new one to replace it.
	 *
	 * @param shell The new launch configuration.
	 */
	reuseTerminal(shell: IShellLaunchConfig): void;

	/**
	 * Sets the title of the terminal instance.
	 */
	setTitle(title: string, eventSource: TitleEventSource): void;

	waitForTitle(): Promise<string>;

	setDimensions(dimensions: ITerminalDimensions): void;

	addDisposable(disposable: IDisposable): void;

	toggleEscapeSequenceLogging(): void;

	getInitialCwd(): Promise<string>;
	getCwd(): Promise<string>;
}
