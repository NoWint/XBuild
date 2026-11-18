import React, { createContext, useContext } from 'react';

export const HomeIdeasContext = createContext(null);
const useIdeas = () => useContext(HomeIdeasContext);
// Data selection is local: these original catalog entries work with a folder or
// attached files. Keep the source labels, prompts, thumbnails and interaction UI.
export const localIdeaIds = new Set(['find-themes-in-files', 'notes-into-clean-docs', 'webpage-into-spreadsheet']);
export const useLocalIdeas = () => useIdeas().ideas;
// Retain the local capability selection while using the installed catalog's
// current prompts, illustrations and list component.
export const useCurrentLocalIdeas = useLocalIdeas;
export const useCurrentIdeaSelection = ({control}) => ({ideas:control,variant:'control',settled:true,needsCatalog:false});
export const loadCurrentIdeaCatalog = async () => ({COWORK_HOME_IDEAS_CATALOG:(await import('./generated/current-chat/c2bf50d9e-Borm-ayr.js')).o});
export const useLocalIdeaSelection = ideas => ({ ideas, variant: 'control', settled: true });
export const loadIdeaCatalog = async () => ({ COWORK_HOME_IDEAS: (await loadCurrentIdeaCatalog()).COWORK_HOME_IDEAS_CATALOG.pool });
export const illustrationColors = () => useIdeas().illustrationColors();
export const ideaTrue = () => true;
export const ideaFalse = () => false;
const localScope = { activeOrganization: { uuid: 'local-profile' } };
// The source treats scope presence as permission to show suggestions. This is a
// local profile boundary, never an Anthropic account or authorization response.
export const useIdeaScope = () => localScope;
const surface = { target: { kind: 'cowork' }, surfaces: {} };
export const useIdeaSurface = () => surface;
export const useIdeaTarget = () => ({ target: surface.target, pick: useIdeas().pick, focusInput: useIdeas().focusInput });
const noSkills = { suggestions: [], isLoading: false }, noCommands = { data: [] };
export const useNoSkillIdeas = () => noSkills;
export const useIdeaCommands = () => noCommands;
export const useIdeaPrompt = () => ({ setPrompt: useIdeas().setPrompt });
export const useIdeaEditor = select => select(useIdeas());
const ignoreAnalytics = () => {};
const analytics = { trackAgentModeEvent: ignoreAnalytics };
export const useIdeaAnalytics = () => analytics;
export const useIdeaTracker = () => ignoreAnalytics;
export const ideaMetricName = 'local';
export const ideaMetricHash = () => 'local';
export const ideaCommandName = name => name;
export const ideaCommandNodes = name => [{ type: 'text', text: `/${name}` }];
export function IdeaLabel({ children }) { return children; }
