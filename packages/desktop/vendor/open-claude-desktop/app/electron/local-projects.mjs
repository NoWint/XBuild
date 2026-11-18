import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function localProjects(config, request, { dataDir, approveFolder = value => value, now = () => new Date().toISOString() }) {
  const projects = Array.isArray(config.localProjects) ? config.localProjects : [];
  if (request.action === 'list') return projects;
  if (request.action === 'create') {
    const name = typeof request.name === 'string' ? request.name.trim() : '';
    const description = typeof request.description === 'string' ? request.description.trim() : '';
    if (!name || name.length > 200) throw new Error('Enter a project name of 1–200 characters.');
    if (description.length > 4000) throw new Error('Project description is too long.');
    if (request.folder && (typeof request.folder !== 'string' || !path.isAbsolute(request.folder))) throw new Error('Choose a directory.');
    const id = randomUUID();
    const cwd = request.folder ? approveFolder(request.folder) : path.join(dataDir, 'projects', id);
    if (request.folder) {
      if (!(await fs.stat(cwd)).isDirectory()) throw new Error('Choose a directory.');
    } else await fs.mkdir(cwd, { recursive: true });
    const timestamp = now();
    const project = { id, name, description, cwd, createdAt: timestamp, updatedAt: timestamp };
    config.localProjects = [...projects, project];
    return project;
  }
  const project = projects.find(entry => entry.id === request.id);
  if (!project) throw new Error('Project not found.');
  if (request.action === 'update') {
    const patch = {};
    for (const [field, limit] of [['name', 200], ['description', 4000], ['instructions', 16000]]) {
      if (!Object.hasOwn(request, field)) continue;
      if (typeof request[field] !== 'string') throw new Error(`Invalid project ${field}.`);
      const value = request[field].trim();
      if (value.length > limit || (field === 'name' && !value)) throw new Error(`Invalid project ${field}.`);
      patch[field] = value;
    }
    if (Object.hasOwn(request, 'isStarred')) {
      if (typeof request.isStarred !== 'boolean') throw new Error('Invalid project pin.');
      patch.isStarred = request.isStarred;
    }
    Object.assign(project, patch, { updatedAt: now() });
    return project;
  }
  if (request.action === 'open') {
    if (!(await fs.stat(project.cwd)).isDirectory()) throw new Error('Project folder is unavailable.');
    project.updatedAt = now();
    config.surfaceFolders = { ...config.surfaceFolders, cowork: project.cwd };
    return project;
  }
  throw new Error('Unknown project operation.');
}

// Consume host-only routing metadata before the request reaches a model provider.
export function applyProjectContext(config, method, params, surface) {
  const explicitId = params.codeDesktop?.projectId;
  if (params.codeDesktop && Object.hasOwn(params.codeDesktop, 'projectId')) {
    const { projectId, ...rest } = params.codeDesktop;
    if (Object.keys(rest).length) params.codeDesktop = rest; else delete params.codeDesktop;
  }
  const id = method === 'thread/start' ? explicitId : method === 'thread/resume' ? config.sessionMetadata?.[params.threadId]?.projectId : null;
  if (!id) return null;
  const project = config.localProjects?.find(project => project.id === id);
  if (!project || (method === 'thread/start' && (surface !== 'cowork' || project.cwd !== params.cwd))) throw new Error('Project does not match this workspace.');
  if (project.instructions) params.developerInstructions = [params.developerInstructions, 'Project instructions:\n' + project.instructions].filter(Boolean).join('\n\n');
  return project;
}
