// SettingsNavSearch cc011544b:846–955. Only observed, current catalog rows
// can produce destinations. A loading catalog from another cwd is not an index.
export const EMPTY_SETTINGS_CATALOG = Object.freeze({});
export function settingsCatalogGroups(snapshot, { cwd, threadId = null } = {}) {
  const ready = key => snapshot?.[key]?.status === 'ready' && snapshot[key].cwd === cwd;
  const skills = ready('skills') ? snapshot.skills.skills : [];
  const plugins = ready('plugins') ? snapshot.plugins.rows : [];
  const pluginById = new Map(plugins.map(plugin => [plugin.id, plugin]));
  const skillEntries = [], pluginEntries = plugins.map(plugin => ({
    id: plugin.id, label: plugin.name, subpathId: plugin.id, focus: { pluginId: plugin.id },
  }));
  for (const skill of skills) {
    if (!skill.path || !skill.name) continue;
    if (!skill.pluginId) {
      skillEntries.push({ id: skill.path, label: skill.name, subpathId: skill.path, focus: { skillPath: skill.path } });
      continue;
    }
    const plugin = pluginById.get(skill.pluginId);
    if (!plugin) continue;
    const entry = {
      id: JSON.stringify([plugin.id, skill.path]), label: `${skill.name} · ${plugin.name}`,
      searchLabel: `${skill.name} ${plugin.name}`, subpathId: [plugin.id, skill.skillName],
      targetSection: 'customize-plugins', focus: { pluginId: plugin.id, skillPath: skill.path },
    };
    skillEntries.push(entry);
    pluginEntries.push({ ...entry, collapseKey: `plugin-skill:${skill.skillName.toLowerCase()}` });
  }
  const connectors = ready('mcp') && snapshot.mcp.threadId === threadId ? snapshot.mcp.rows : [];
  return [
    { tab: 'customize-skills', rows: skillEntries },
    { tab: 'customize-connectors', rows: connectors.map(row => ({ id: row.name, label: row.title, subpathId: row.name, focus: { connectorName: row.name } })) },
    { tab: 'customize-plugins', rows: pluginEntries },
  ];
}
