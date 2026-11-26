'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, closestCorners } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, ArrowDownUp, Bell, Camera, Check, ChevronDown, Circle, CircleCheck, CircleDashed, CircleHelp, Clock3, Command, Filter, LayoutDashboard, LayoutGrid, ListTodo, LoaderCircle, MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, Sparkles, Sun, Moon, Users, X, Zap, type LucideIcon } from 'lucide-react'
import type { Priority, Status, Task } from '@/lib/board-store'

const statuses: Status[] = ['Backlog', 'Todo', 'In Progress', 'Done']
const fallbackPeople = ['Surajit', 'Maya', 'Alex', 'Jordan']
const colors: Record<string, string> = { surajit: 'violet', maya: 'coral', alex: 'blue', jordan: 'mint', anup: 'coral', meera: 'blue', rohan: 'mint' }
const statusIcon: Record<Status, LucideIcon> = { Backlog: CircleDashed, Todo: Circle, 'In Progress': LoaderCircle, Done: CircleCheck }

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '')

function displayUser(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const targetUrl = url.startsWith('/api') ? `${API_BASE}${url}` : url
  const response = await fetch(targetUrl, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Something went wrong')
  return body
}

function Avatar({ name, small = false, image }: { name: string; small?: boolean; image?: string }) {
  return <span className={`avatar avatar-${colors[name.toLowerCase()] || 'violet'} ${small ? 'avatar-small' : ''}`} title={displayUser(name)} aria-label={displayUser(name)}>{image ? <img className="avatar-image" src={image} alt="" /> : name.slice(0, 1).toUpperCase()}</span>
}
async function optimizeAvatar(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.')
  const bitmap = await createImageBitmap(file)
  const size = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare this image.')
  context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 320, 320)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.82)
}
function Stat({ icon: Icon, label, value, change, tone }: { icon: LucideIcon; label: string; value: string | number; change?: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={16} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong></div>{change && <span className="stat-change">{change}</span>}</div>
}
function ColumnDropArea({ status, children }: { status: Status; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return <div ref={setNodeRef} className={`column-list ${isOver ? 'column-is-over' : ''}`} data-drop-status={status}>{children}</div>
}

function TaskCard({ task, onOpen, isOverlay = false, profileImages = {} }: { task: Task; onOpen: (task: Task) => void; isOverlay?: boolean; profileImages?: Record<string, string> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: isOverlay })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} onClick={() => onOpen(task)} className={`task-card ${isDragging ? 'is-dragging' : ''} ${isOverlay ? 'drag-overlay' : ''}`}>
    <div className="task-top"><span className={`priority-dot ${task.priority}`} /><span className="task-id">{task.id.startsWith('nex-') ? task.id.toUpperCase() : `NX-${task.id.slice(0, 4).toUpperCase()}`}</span><button className="icon-button task-menu" aria-label="Task options" onClick={(event) => event.stopPropagation()}><MoreHorizontal size={16} /></button></div>
    <h3>{task.title}</h3><p className="task-description">{task.description || 'Add a little context so your team knows what to do next.'}</p>
    {task.labels.length > 0 && <div className="label-row">{task.labels.slice(0, 2).map((label) => <span className="task-label" key={label}>{label}</span>)}{task.labels.length > 2 && <span className="task-label">+{task.labels.length - 2}</span>}</div>}
    <div className="task-footer"><span className={`priority-label ${task.priority}`}>{task.priority} priority</span><div className="task-meta"><span className="task-time"><Clock3 size={12} /> {relativeTime(task.updatedAt)}</span><Avatar name={task.assignee} small image={profileImages[task.assignee]} /></div></div>
  </article>
}
function relativeTime(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1440)}d`
}
function TaskDialog({ task, initialStatus, people, currentUser, onClose, onSave, onDelete }: { task: Task | null; initialStatus: Status; people: string[]; currentUser: string; onClose: () => void; onSave: (values: Partial<Task> & { title: string; status: Status }) => Promise<void>; onDelete?: (task: Task) => void }) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium')
  const [assignee, setAssignee] = useState(task?.assignee || currentUser)
  const [status, setStatus] = useState<Status>(task?.status || initialStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) { setError('Give this task a clear title.'); return }
    setBusy(true); setError('')
    try { await onSave({ title: title.trim(), description: description.trim(), priority, assignee, status }); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this task.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.form initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onSubmit={submit}>
    <div className="modal-header"><div><span className="eyebrow">{task ? 'TASK DETAILS' : 'NEW TASK'}</span><h2 id="task-dialog-title">{task ? 'Make it happen.' : 'Add to the board.'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
    <label className="field-label">Task name<input autoFocus maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Launch the new experience" /></label>
    <label className="field-label">Description<textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does success look like?" /></label>
    <div className="form-grid"><label className="field-label">Status<select value={status} onChange={(event) => setStatus(event.target.value as Status)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-label">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
    <label className="field-label">Assignee<select value={assignee} onChange={(event) => setAssignee(event.target.value)}>{people.map((person) => <option key={person} value={person}>{displayUser(person)}</option>)}</select></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions">{task && onDelete && <button type="button" className="delete-button" onClick={() => onDelete(task)}>Delete task</button>}<button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button></div>
  </motion.form></div>
}

export default function Nexboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<{ id: string; text: string; time: string; user: string }[]>([])
  const [activeUsers, setActiveUsers] = useState<string[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState<Task | null>(null)
  const [dialog, setDialog] = useState<{ task: Task | null; status: Status } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [section, setSection] = useState('Kanban Board')
  const [currentUser, setCurrentUser] = useState('Surajit')
  const [teamMembers, setTeamMembers] = useState(fallbackPeople)
  const [profileImages, setProfileImages] = useState<Record<string, string>>({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const remoteDeletedIds = useRef(new Set<string>())
  const [filterOpen, setFilterOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const searchParams = useSearchParams()
  const router = useRouter()
  const search = searchParams.get('search') || ''
  const priorityFilter = searchParams.get('priority') || 'all'
  const assigneeFilter = searchParams.get('assignee') || 'all'
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const refresh = useCallback(async () => {
    try {
      const result = await request<{ tasks: Task[]; activity: typeof activity; profileImages?: Record<string, string> }>('/api/board')
      const members = [...new Set(result.tasks.map((task) => task.assignee).filter(Boolean))]
      if (members.length > 0) {
        setTeamMembers(members)
        setCurrentUser((user) => members.find((member) => member.toLowerCase() === user.toLowerCase()) || members[0])
      }
      setTasks(result.tasks); setActivity(result.activity); setProfileImages(result.profileImages || {}); setLoaded(true)
    } catch { setLoaded(true); notify('Could not connect to the board API.') }
  }, [])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }
  async function saveProfileImage() {
    setProfileSaving(true); setProfileError('')
    try {
      const result = await request<{ profileImages: Record<string, string> }>('/api/profile', { method: 'PUT', body: JSON.stringify({ user: currentUser, image: profilePreview === '' ? null : profilePreview ?? profileImages[currentUser] ?? null }) })
      setProfileImages(result.profileImages)
      setProfileOpen(false); setProfilePreview(null); notify('Profile photo saved')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile photo.')
    } finally { setProfileSaving(false) }
  }
  function openInviteDialog() {
    setInviteEmail('')
    setInviteError('')
    setInviteLink(`${window.location.origin}/board`)
    setInviteOpen(true)
  }
  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      notify('Invite link copied')
    } catch {
      setInviteError('Could not access the clipboard. Select and copy the link below.')
    }
  }
  function sendInvite() {
    const email = inviteEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Enter a valid work email address.')
      return
    }
    setInviteError('')
    const subject = encodeURIComponent('Join me on Northstar Studio')
    const body = encodeURIComponent(`Join me on the Nexboard workspace:\n${inviteLink}`)
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`
    setInviteOpen(false)
    notify('Invite email opened')
  }
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    setActiveUsers(null)
    const stream = new EventSource(`${API_BASE}/api/events?user=${encodeURIComponent(currentUser)}`)
    const handledEvents = new Set<string>()
    const handleStreamEvent = (message: Event) => {
      if (!(message instanceof MessageEvent)) return
      try {
        const event = JSON.parse(message.data)
        const eventType = typeof event.type === 'string' ? event.type : message.type
        const eventId = typeof event.id === 'string' ? event.id : typeof event.eventId === 'string' ? event.eventId : message.lastEventId
        if (eventType === 'PRESENCE' && Array.isArray(event.activeUsers)) {
          setActiveUsers(event.activeUsers.filter((user: unknown): user is string => typeof user === 'string'))
        }
        if (eventId) {
          if (handledEvents.has(eventId)) return
          handledEvents.add(eventId)
          if (handledEvents.size > 300) handledEvents.delete(handledEvents.values().next().value as string)
        }
        if (eventType === 'TASK_DELETED') {
          const taskId = typeof event.taskId === 'string' ? event.taskId : typeof event.task?.id === 'string' ? event.task.id : null
          if (taskId) {
            remoteDeletedIds.current.add(taskId)
            if (remoteDeletedIds.current.size > 300) remoteDeletedIds.current.delete(remoteDeletedIds.current.values().next().value as string)
            setTasks((current) => current.filter((task) => task.id !== taskId))
          }
        }
        else if (Array.isArray(event.tasks)) setTasks((current) => {
          const remoteTasks = event.tasks as Task[]
          const merged = current.map((local) => {
            const remote = remoteTasks.find((task) => task.id === local.id)
            return remote && remote.version >= local.version ? remote : local
          })
          for (const remote of remoteTasks) if (!current.some((local) => local.id === remote.id)) merged.push(remote)
          return merged
        })
        else if (event.task) setTasks((current) => {
          const remote = event.task as Task
          const existing = current.find((task) => task.id === remote.id)
          const next = existing ? current.map((task) => task.id === remote.id && remote.version >= task.version ? remote : task) : [...current, remote]
          return next.sort((a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status) || a.position - b.position)
        })
        if (event.activity) {
          const activity = {
            id: typeof event.activity.id === 'string' ? event.activity.id : eventId,
            text: typeof event.activity.text === 'string' ? event.activity.text : '',
            time: typeof event.activity.time === 'string' ? event.activity.time : event.activity.at,
            user: typeof event.activity.user === 'string' ? event.activity.user : 'Someone',
          }
          if (activity.id && activity.time) setActivity((current) => [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 30))
        }
      } catch { /* Ignore malformed stream messages. */ }
    }
    stream.onmessage = handleStreamEvent
    for (const type of ['TASK_CREATED', 'TASK_UPDATED', 'TASK_MOVED', 'TASK_DELETED', 'ACTIVITY', 'PRESENCE']) {
      stream.addEventListener(type, handleStreamEvent)
    }
    stream.onerror = () => {
      setActiveUsers(null)
    }
    return () => stream.close()
  }, [currentUser])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('task-search')?.focus()
      }
      if (event.key === 'Escape') { setDialog(null); setActive(null) }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])
  useEffect(() => { const timeout = window.setTimeout(() => { if (toast) setToast('') }, 3200); return () => window.clearTimeout(timeout) }, [toast])

  function updateQuery(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' || !value) params.delete(key); else params.set(key, value)
    router.replace(`/board?${params.toString()}`, { scroll: false })
  }
  const filtered = useMemo(() => tasks.filter((task) => (section !== 'My Tasks' || task.assignee.toLowerCase() === currentUser.toLowerCase()) && (!search || `${task.title} ${task.description} ${task.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase())) && (priorityFilter === 'all' || task.priority === priorityFilter) && (assigneeFilter === 'all' || task.assignee.toLowerCase() === assigneeFilter.toLowerCase())), [tasks, search, priorityFilter, assigneeFilter, section, currentUser])
  const counts = useMemo(() => statuses.map((status) => ({ status, count: tasks.filter((task) => task.status === status).length })), [tasks])
  const completed = tasks.filter((task) => task.status === 'Done').length
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0
  const activeTask = tasks.find((task) => task.id === activeId) || null
  const onlineTeammates = activeUsers?.filter((user) => user.toLowerCase() !== currentUser.toLowerCase()) ?? []

  async function saveTask(values: Partial<Task> & { title: string; status: Status }, old?: Task) {
    const before = tasks
    const newTask: Task = { id: old?.id || `temp-${Date.now()}`, title: values.title, description: values.description || '', priority: values.priority || 'medium', assignee: values.assignee || currentUser, status: values.status, position: old?.position ?? tasks.filter((item) => item.status === values.status).length, updatedAt: new Date().toISOString(), labels: old?.labels || [], version: (old?.version || 0) + 1 }
    if (old) setActive(newTask)
    setTasks((current) => old ? current.map((item) => item.id === old.id ? newTask : item) : [...current, newTask])
    try {
      const result = await request<Task | { task: Task }>('/api/tasks' + (old ? `/${old.id}` : ''), { method: old ? 'PATCH' : 'POST', body: JSON.stringify({ ...values, user: currentUser }) })
      const savedTask = 'task' in result ? result.task : result
      if (!savedTask || typeof savedTask.id !== 'string') throw new Error('The task was saved, but the API returned an invalid task response.')
      setTasks((current) => {
        const alreadyReconciled = current.some((item) => item.id === savedTask.id)
        const withoutOptimistic = old ? current : current.filter((item) => item.id !== newTask.id)
        if (alreadyReconciled) return withoutOptimistic.map((item) => item.id === savedTask.id && item.version <= savedTask.version ? savedTask : item)
        if (old) return current.map((item) => item.id === old.id && item.version <= newTask.version ? savedTask : item)
        return [...current.filter((item) => item.id !== newTask.id), savedTask]
      })
      if (old) setActive(savedTask)
      notify(old ? 'Task updated' : 'Task added to the board')
    } catch (error) {
      setTasks((current) => old ? current.map((item) => item.id === old.id && item.version === newTask.version ? old : item) : current.filter((item) => item.id !== newTask.id))
      if (old) setActive((current) => current?.id === old.id && current.version === newTask.version ? old : current)
      throw error
    }
  }
  async function removeTask(task: Task) {
    if (!window.confirm(`Delete “${task.title}”? This can’t be undone.`)) return
    setTasks((current) => current.filter((item) => item.id !== task.id)); setDialog(null); setActive(null)
    try { await request(`/api/tasks/${task.id}`, { method: 'DELETE', body: JSON.stringify({ user: currentUser }) }); notify('Task deleted') }
    catch {
      if (!remoteDeletedIds.current.has(task.id)) {
        setTasks((current) => {
          if (current.some((item) => item.id === task.id)) return current
          const column = current.filter((item) => item.status === task.status).sort((a, b) => a.position - b.position)
          const restored = { ...task, position: Math.min(task.position, column.length) }
          column.splice(restored.position, 0, restored)
          const positions = new Map(column.map((item, index) => [item.id, index]))
          return [...current.filter((item) => item.status !== task.status), ...column.map((item, index) => ({ ...item, position: positions.get(item.id) ?? index }))]
        })
      }
      notify('Could not delete task. Your board was restored.')
    }
  }
  async function moveTask(taskId: string, status: Status, position: number) {
    const before = tasks
    const source = tasks.find((task) => task.id === taskId)
    if (!source) return
    const now = new Date().toISOString()
    const optimistic = new Map<string, Task>()
    for (const column of statuses) {
      const ordered = tasks.filter((task) => task.status === column && task.id !== taskId).sort((a, b) => a.position - b.position)
      if (column === status) ordered.splice(Math.min(position, ordered.length), 0, source)
      ordered.forEach((task, index) => {
        const nextStatus = task.id === taskId ? status : column
        const changed = task.status !== nextStatus || task.position !== index
        optimistic.set(task.id, changed ? { ...task, status: nextStatus, position: index, updatedAt: now, version: task.version + 1 } : task)
      })
    }
    const next = tasks.map((task) => optimistic.get(task.id) ?? task)
    setTasks(next)
    try {
      const result = await request<{ tasks: Task[] }>('/api/tasks/' + taskId, { method: 'PATCH', body: JSON.stringify({ status, position, user: currentUser }) })
      setTasks((current) => current.map((task) => {
        const remote = result.tasks.find((item) => item.id === task.id)
        return remote && remote.version >= task.version ? remote : task
      }))
    } catch {
      setTasks((current) => current.map((task) => {
        const previous = before.find((item) => item.id === task.id)
        const optimisticVersion = optimistic.get(task.id)?.version
        return previous && task.version === optimisticVersion ? previous : task
      }))
      notify('Move failed. The previous order was restored.')
    }
  }
  function onDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)) }
  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active: dragged, over } = event
    if (!over || dragged.id === over.id) return
    const source = tasks.find((task) => task.id === dragged.id)
    const destination = tasks.find((task) => task.id === over.id)
    const status = statuses.includes(String(over.id) as Status) ? String(over.id) as Status : destination?.status
    if (!source || !status) return
    const list = tasks.filter((task) => task.status === status && task.id !== source.id).sort((a, b) => a.position - b.position)
    const targetIndex = destination ? list.findIndex((task) => task.id === destination.id) : list.length
    const pos = Math.max(0, targetIndex < 0 ? list.length : targetIndex)
    void moveTask(source.id, status, pos)
  }
  function onDragOver(event: DragEndEvent) { /* Destination columns are droppable through their status IDs. */ }

  return <main className="app-shell" data-theme={theme}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={16} strokeWidth={2.2} aria-hidden="true" /></div><span>NEXBOARD</span><span className="brand-beta">BETA</span></div>
      <button className="workspace-switch"><span className="workspace-icon">N</span><span className="workspace-copy"><strong>Northstar Studio</strong><small>Pro workspace</small></span><ChevronDown size={14} /></button>
      <div className="nav-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Workspace navigation">{[{ name: 'Overview', icon: LayoutDashboard }, { name: 'My Tasks', icon: ListTodo }, { name: 'Kanban Board', icon: LayoutGrid }, { name: 'Activity', icon: Activity }].map(({ name, icon: Icon }) => <button key={name} onClick={() => setSection(name)} className={`nav-item ${section === name ? 'selected' : ''}`}><Icon size={16} /><span>{name}</span>{name === 'My Tasks' && <span className="nav-count">4</span>}</button>)}</nav>
      <div className="nav-label projects-label">YOUR PROJECTS <button className="tiny-plus" aria-label="Add project"><Plus size={14} /></button></div>
      <button className="project-link"><span className="project-bullet purple" />Product Development <span className="project-dots">•••</span></button><button className="project-link"><span className="project-bullet blue" />Website Redesign</button><button className="project-link"><span className="project-bullet green" />Q4 Launch</button>
      <div className="sidebar-bottom"><button className="nav-item"><Settings2 size={16} /><span>Settings</span></button><button className="nav-item"><CircleHelp size={16} /><span>Help & feedback</span></button><div className="profile-card"><button className="profile-photo-trigger" aria-label="Edit profile photo" title="Edit profile photo" onClick={() => { setProfileOpen(true); setProfilePreview(null); setProfileError('') }}><Avatar name={currentUser} image={profileImages[currentUser]} /><span><Camera size={11} /></span></button><span className="profile-copy"><strong>{displayUser(currentUser)} Das</strong><small>Product designer</small></span><button className="icon-button" aria-label="Switch demo user" title="Switch demo user" onClick={() => setCurrentUser((user) => teamMembers[(teamMembers.indexOf(user) + 1) % teamMembers.length] || user)}><ArrowDownUp size={14} /></button></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Projects</span><span className="crumb-slash">/</span><strong>Product Development</strong></div><div className="topbar-actions"><div className="live-status"><span className="live-dot" />All changes saved</div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><i /></button><button className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>{onlineTeammates.length > 0 && <span className="active-teammates"><span className="presence-live" />{onlineTeammates.map(displayUser).join(', ')} {onlineTeammates.length === 1 ? 'is' : 'are'} active</span>}<button className="invite-button" type="button" onClick={openInviteDialog}><Users size={14} /> Invite</button></div></header>
      <div className="page-content">
        {section === 'Overview' ? <Overview tasks={tasks} activity={activity} progress={progress} counts={counts} profileImages={profileImages} /> : section === 'Activity' ? <ActivityView activity={activity} profileImages={profileImages} /> : <>
          <div className="board-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> TEAM WORKSPACE <span className="eyebrow-separator">/</span> ROADMAP</div><div className="heading-line"><h1>Product Development</h1><button className="icon-button" aria-label="Board options"><MoreHorizontal size={20} /></button></div><p className="board-subtitle">A shared space to turn big ideas into real momentum.</p></div><div className="heading-actions"><div className="progress-ring" style={{ '--progress': `${progress}%` } as React.CSSProperties}><span>{progress}%</span></div><div className="progress-copy"><strong>Board progress</strong><small>{completed} of {tasks.length} tasks complete</small></div><button className="button button-primary create-button" onClick={() => setDialog({ task: null, status: 'Todo' })}><Plus size={16} /> New task</button></div></div>
          <div className="board-insights"><div className="insight-main"><Sparkles size={15} /><span><strong>Looking good.</strong> Your team has <b>{tasks.filter((task) => task.status === 'In Progress').length} tasks</b> in motion right now.</span></div>{onlineTeammates.length > 0 && <><span className="insight-divider" /><div className="insight-right"><span className="presence-live" />{onlineTeammates.map(displayUser).join(', ')} {onlineTeammates.length === 1 ? 'is' : 'are'} active</div></>}</div>
          <div className="board-toolbar"><div className="view-tabs"><button className="view-tab active"><LayoutGrid size={15} /> Board</button><button className="view-tab" onClick={() => setSection('My Tasks')}><ListTodo size={15} /> My tasks</button><span className="toolbar-divider" /><button className="view-tab" onClick={() => setSection('Activity')}><Activity size={15} /> Activity</button></div><div className="board-tools"><label className="search-box"><Search size={15} /><input id="task-search" aria-label="Search tasks" aria-keyshortcuts="Control+K Meta+K" value={search} onChange={(event) => updateQuery('search', event.target.value)} placeholder="Search tasks..." /><kbd>⌘ K</kbd></label><button className={`tool-button ${filterOpen || priorityFilter !== 'all' || assigneeFilter !== 'all' ? 'tool-active' : ''}`} onClick={() => setFilterOpen((open) => !open)}><SlidersHorizontal size={15} /> Filters{priorityFilter !== 'all' || assigneeFilter !== 'all' ? <span className="filter-badge">!</span> : null}</button><button className="icon-button sort-button" aria-label="Sort tasks"><ArrowDownUp size={15} /></button></div></div>
          {filterOpen && <div className="filter-row"><Filter size={14} /><span>Filter by</span><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => updateQuery('priority', event.target.value)}><option value="all">Any priority</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><select aria-label="Filter by assignee" value={assigneeFilter} onChange={(event) => updateQuery('assignee', event.target.value)}><option value="all">Anyone</option>{teamMembers.map((person) => <option key={person} value={person.toLowerCase()}>{displayUser(person)}</option>)}</select>{(search || priorityFilter !== 'all' || assigneeFilter !== 'all') && <button className="clear-filters" onClick={() => router.replace('/board', { scroll: false })}>Clear filters <X size={12} /></button>}</div>}
          {section === 'My Tasks' && <div className="my-tasks-note">Showing tasks assigned to <strong>{displayUser(currentUser)}</strong>. <button onClick={() => updateQuery('assignee', currentUser.toLowerCase())}>Show mine</button></div>}
          <div className="kanban-wrap"><DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            <div className="kanban-board">{statuses.map((status, index) => {
              const columnTasks = filtered.filter((task) => task.status === status).sort((a, b) => a.position - b.position)
              const StatusIcon = statusIcon[status]
              return <div className="kanban-column" key={status} data-status={status}>
                <div className="column-heading"><div className={`column-indicator indicator-${index}`}><StatusIcon size={14} strokeWidth={2} aria-hidden="true" /></div><h2>{status}</h2><span className="column-count">{columnTasks.length}</span><button className="icon-button column-menu" aria-label={`${status} options`}><MoreHorizontal size={16} /></button><button className="icon-button column-add" aria-label={`Add task to ${status}`} onClick={() => setDialog({ task: null, status })}><Plus size={16} /></button></div>
                <SortableContext items={columnTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}><ColumnDropArea status={status}>{columnTasks.map((task) => <TaskCard key={task.id} task={task} onOpen={(selected) => setActive(selected)} profileImages={profileImages} />)}
                  {columnTasks.length === 0 && <div className="empty-column"><span className="empty-icon"><StatusIcon size={16} strokeWidth={1.8} aria-hidden="true" /></span><strong>{loaded ? 'Nothing here yet' : 'Loading tasks…'}</strong><span>{loaded ? 'Drop a task here or create one.' : 'Getting your workspace ready'}</span></div>}
                  <button className="add-task-inline" onClick={() => setDialog({ task: null, status })}><Plus size={14} /> Add a task</button></ColumnDropArea></SortableContext>
              </div>
            })}</div><DragOverlay>{activeTask ? <TaskCard task={activeTask} onOpen={() => {}} isOverlay profileImages={profileImages} /> : null}</DragOverlay>
          </DndContext></div>
        </>}
        <footer className="board-footer"><span><span className="footer-live" /> Live board</span><span>Synced just now</span><button><Command size={12} /> Keyboard shortcuts</button></footer>
      </div>
    </section>
    <AnimatePresence>{active && !dialog && <motion.aside initial={{ x: 360 }} animate={{ x: 0 }} exit={{ x: 360 }} className="detail-panel"><div className="detail-head"><span className="eyebrow">TASK DETAILS</span><button className="icon-button" onClick={() => { setActive(null); setDialog(null) }} aria-label="Close task detail"><X size={18} /></button></div><div className="detail-content"><span className="task-id">{active.id.toUpperCase()}</span><h2>{active.title}</h2><p>{active.description || 'No description yet. Add more context to help your team.'}</p><div className="detail-field"><span>Status</span><select value={active.status} onChange={(event) => void saveTask({ title: active.title, status: event.target.value as Status, priority: active.priority, assignee: active.assignee, description: active.description }, active).catch((error) => notify(error instanceof Error ? error.message : 'Could not update task.'))}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div><div className="detail-field"><span>Priority</span><select value={active.priority} onChange={(event) => void saveTask({ title: active.title, status: active.status, priority: event.target.value as Priority, assignee: active.assignee, description: active.description }, active).catch((error) => notify(error instanceof Error ? error.message : 'Could not update task.'))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div className="detail-field"><span>Assignee</span><select value={active.assignee} onChange={(event) => void saveTask({ title: active.title, status: active.status, priority: active.priority, assignee: event.target.value, description: active.description }, active).catch((error) => notify(error instanceof Error ? error.message : 'Could not update task.'))}>{teamMembers.map((person) => <option key={person} value={person}>{displayUser(person)}</option>)}</select></div><div className="detail-divider" /><div className="detail-updated"><Clock3 size={14} /> Updated {relativeTime(active.updatedAt)} ago</div><button className="detail-edit-button" onClick={() => setDialog({ task: active, status: active.status })}>Edit task details</button></div></motion.aside>}</AnimatePresence>
    {dialog && <TaskDialog task={dialog.task} initialStatus={dialog.status} people={teamMembers} currentUser={currentUser} onClose={() => setDialog(null)} onSave={(values) => saveTask(values, dialog.task || undefined)} onDelete={removeTask} />}
    {inviteOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInviteOpen(false)}><section className="profile-modal invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
      <div className="modal-header"><div><span className="eyebrow">TEAM INVITE</span><h2 id="invite-dialog-title">Invite a teammate</h2></div><button type="button" className="icon-button" aria-label="Close invite dialog" onClick={() => setInviteOpen(false)}><X size={18} /></button></div>
      <p className="profile-modal-copy">Send an invitation or copy a link to the Product Development workspace.</p>
      <label className="field-label">Work email<input type="email" autoFocus value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteError('') }} placeholder="name@company.com" /></label>
      {inviteError && <p className="form-error" role="alert">{inviteError}</p>}
      <div className="invite-link-row"><input aria-label="Invite link" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="button button-secondary" onClick={() => void copyInviteLink()}>Copy link</button></div>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setInviteOpen(false)}>Cancel</button><button type="button" className="button button-primary" onClick={sendInvite}>Send invite</button></div>
    </section></div>}
    {profileOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title"><div className="modal-header"><div><span className="eyebrow">DEMO PROFILE</span><h2 id="profile-dialog-title">Your profile photo</h2></div><button className="icon-button" aria-label="Close profile editor" onClick={() => setProfileOpen(false)}><X size={18} /></button></div><p className="profile-modal-copy">Choose a photo for {displayUser(currentUser)}. It will appear on your tasks and activity.</p><div className="profile-photo-preview">{(profilePreview ?? profileImages[currentUser]) ? <img src={profilePreview ?? profileImages[currentUser]} alt={`Profile preview for ${displayUser(currentUser)}`} /> : <span>{displayUser(currentUser).slice(0, 1)}</span>}</div><label className="button button-secondary profile-upload"><Camera size={15} /> Choose image<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void optimizeAvatar(file).then(setProfilePreview).catch((error: unknown) => setProfileError(error instanceof Error ? error.message : 'Could not open this image.')) }} /></label>{(profilePreview || profileImages[currentUser]) && <button className="profile-remove" onClick={() => setProfilePreview('')}>Remove photo</button>}{profileError && <p className="form-error" role="alert">{profileError}</p>}<div className="modal-actions"><button className="button button-quiet" onClick={() => setProfileOpen(false)}>Cancel</button><button className="button button-primary" onClick={() => void saveProfileImage()} disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save photo'}</button></div></section></div>}
    <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><span><Check size={14} /></span>{toast}</motion.div>}</AnimatePresence>
  </main>
}

function Overview({ tasks, activity, progress, counts, profileImages }: { tasks: Task[]; activity: { id: string; text: string; time: string; user: string }[]; progress: number; counts: { status: Status; count: number }[]; profileImages: Record<string, string> }) {
  const overdue = tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done').length
  return (
    <div className="overview-page">
      <div className="board-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> TEAM WORKSPACE</div>
          <h1>Good morning, team.</h1>
          <p className="board-subtitle">Here’s what’s happening across your projects today.</p>
        </div>
      </div>
      <div className="stats-grid">
        <Stat icon={ListTodo} label="Total tasks" value={tasks.length} change="Across this board" tone="tone-violet" />
        <Stat icon={Zap} label="In progress" value={counts.find((item) => item.status === 'In Progress')?.count || 0} change="Active right now" tone="tone-blue" />
        <Stat icon={Check} label="Completed" value={counts.find((item) => item.status === 'Done')?.count || 0} change={`${progress}% completion`} tone="tone-green" />
        <Stat icon={Clock3} label="Overdue" value={overdue} change="Past due date" tone="tone-amber" />
      </div>
      <div className="overview-grid">
        <section className="overview-card progress-card">
          <div className="overview-card-head">
            <div><span className="eyebrow">PROJECT HEALTH</span><h2>Product Development</h2></div>
            <span className="health-pill"><span /> On track</span>
          </div>
          <div className="big-progress"><strong>{progress}<small>%</small></strong><span>of the work is complete</span></div>
          <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
          <div className="distribution">{counts.map(({ status, count }, index) => <div key={status}><span className={`distribution-dot dot-${index}`} /><span>{status}</span><strong>{count}</strong></div>)}</div>
        </section>
        <section className="overview-card activity-card">
          <div className="overview-card-head">
            <div><span className="eyebrow">WHAT’S HAPPENING</span><h2>Recent activity</h2></div>
            <button className="icon-button"><MoreHorizontal size={18} /></button>
          </div>
          <div className="activity-list">{activity.slice(0, 5).map((item) => <div className="activity-item" key={item.id}><Avatar name={item.user} small image={profileImages[item.user]} /><div><p><strong>{displayUser(item.user)}</strong> {item.text}</p><span>{relativeTime(item.time)} ago</span></div></div>)}</div>
        </section>
      </div>
    </div>
  )
}
function ActivityView({ activity, profileImages }: { activity: { id: string; text: string; time: string; user: string }[]; profileImages: Record<string, string> }) {
  return (
    <div className="overview-page">
      <div className="board-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> TEAM WORKSPACE</div>
          <h1>Activity</h1>
          <p className="board-subtitle">The latest moves across your workspace.</p>
        </div>
      </div>
      <section className="overview-card activity-card full-activity">
        <div className="activity-list">
          {activity.map((item) => <div className="activity-item" key={item.id}><Avatar name={item.user} small image={profileImages[item.user]} /><div><p><strong>{displayUser(item.user)}</strong> {item.text}</p><span>{new Date(item.time).toLocaleString()}</span></div></div>)}
          {activity.length === 0 && <p className="empty-activity">Your team’s updates will show up here.</p>}
        </div>
      </section>
    </div>
  )
}
