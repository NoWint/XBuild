// Desktop product surfaces are independent of a core's permission modes.
// Old sessions without a surface belong to Code; never reclassify their history.
export const SURFACES = Object.freeze(['chat', 'cowork', 'code']);
export const validSurface = value => SURFACES.includes(value);
export const sessionSurface = (id, metadata = {}) => validSurface(metadata?.[id]?.surface) ? metadata[id].surface : 'code';
export const surfaceDraftKey = (surface = 'code', side = 0) => `${surface === 'code' ? 'epitaxy' : surface}-draft${side ? '-split' : ''}`;
export const surfaceSessions = (sessions, surface, metadata) => sessions.filter(session => surface === 'code' ? sessionSurface(session.id, metadata) === 'code' : sessionSurface(session.id, metadata) !== 'code');
export const surfaceInstructions = surface => surface === 'chat'
  ? 'You are a conversational assistant in XBuild. Answer the user directly in their language. Help with writing, explanation, analysis and brainstorming. Do not inspect the working directory unless the user asks about files. Do not edit files or execute commands. Use attached files only as context when requested.'
  : surface === 'cowork'
    ? 'You are a task assistant in XBuild Cowork. Help the user complete work with documents, research, data and files. For multi-step work, maintain a concise plan using the plan tool. Work in the selected working directory. Preserve source files unless asked to change them. Create useful deliverables and link to their actual file paths in the final answer. Follow the user language; do not claim work finished without checking the result.'
    : '';

// UI-only request metadata must not leak into native core protocols.
export function takeSurface(params) {
  const value = params.codeDesktop?.surface;
  if (value === undefined) return null;
  if (!validSurface(value)) throw new Error('Choose a valid workspace.');
  const { surface, ...rest } = params.codeDesktop;
  if (Object.keys(rest).length) params.codeDesktop = rest;
  else delete params.codeDesktop;
  return surface;
}
