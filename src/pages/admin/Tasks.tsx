import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/store";
import {
  fetchAllTasks,
  fetchAllWorkers,
  createTask,
  updateTaskStatus,
} from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Task, Profile } from "@/types";

type FilterTab = Task["status"] | "all";

const STATUS_LABELS: Record<Task["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<Task["status"], "default" | "lavender" | "warning" | "success" | "danger"> = {
  open: "default",
  in_progress: "lavender",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
};

type TaskWithProfile = Task & { profiles?: { full_name: string; email: string } | null };

const EMPTY_FORM = {
  title: "",
  description: "",
  assigned_to: "",
  reward_amount: "",
  deadline: "",
};

export function AdminTasks() {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedTask, setSelectedTask] = useState<TaskWithProfile | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAllTasks().then(({ data }) => { if (data) setTasks(data as TaskWithProfile[]); });
    fetchAllWorkers().then(({ data }) => { if (data) setWorkers(data); });
  }, []);

  useRealtime<{ new: TaskWithProfile; old: TaskWithProfile }>(
    "admin-tasks",
    { table: "tasks", event: "UPDATE", enabled: !!profile },
    (payload) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } : t))
      );
      setSelectedTask((prev) => (prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev));
    }
  );

  useRealtime<{ new: TaskWithProfile }>(
    "admin-tasks-insert",
    { table: "tasks", event: "INSERT", enabled: !!profile },
    (payload) => {
      setTasks((prev) => [payload.new, ...prev]);
    }
  );

  const filteredTasks = tasks
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.profiles?.full_name?.toLowerCase().includes(q) ||
        t.profiles?.email?.toLowerCase().includes(q)
      );
    });

  const counts = (["open", "in_progress", "submitted", "approved", "rejected"] as Task["status"][]).reduce(
    (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s).length }),
    {} as Record<Task["status"], number>
  );

  const handleCreate = async () => {
    if (!profile || !form.title.trim() || !form.reward_amount) return;
    setIsCreating(true);
    const { data } = await createTask({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      created_by: profile.id,
      reward_amount: parseFloat(form.reward_amount),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      status: "open",
    });
    if (data) {
      setTasks((prev) => [data as TaskWithProfile, ...prev]);
    } else {
      toast("Failed to create task.", "error");
    }
    setForm(EMPTY_FORM);
    setShowCreate(false);
    setIsCreating(false);
  };

  const handleApprove = async (task: TaskWithProfile) => {
    if (isActing) return;
    setIsActing(true);
    try {
      await updateTaskStatus(task.id, "approved");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "approved" as const } : t)));
      setSelectedTask((prev) => (prev?.id === task.id ? { ...prev, status: "approved" as const } : prev));
    } catch {
      toast("Failed to update task.", "error");
    }
    setIsActing(false);
  };

  const handleReject = async (task: TaskWithProfile) => {
    if (isActing) return;
    setIsActing(true);
    try {
      await updateTaskStatus(task.id, "rejected");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "rejected" as const } : t)));
      setSelectedTask((prev) => (prev?.id === task.id ? { ...prev, status: "rejected" as const } : prev));
    } catch {
      toast("Failed to update task.", "error");
    }
    setIsActing(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora font-semibold text-2xl text-text-primary">Tasks</h1>
          <p className="text-text-muted font-sans text-sm mt-0.5">
            {tasks.length} total · {counts.submitted} awaiting review
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
          + New Task
        </Button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-bg-surface border border-border rounded-2xl p-6 shadow-2xl animate-fade_in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-sora font-semibold text-lg text-text-primary">Create Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-grotesk text-text-muted block mb-1">Title *</label>
                <input
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-sans text-text-primary focus:outline-none focus:border-coral/50"
                  placeholder="Task title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-grotesk text-text-muted block mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-sans text-text-primary focus:outline-none focus:border-coral/50 resize-none"
                  placeholder="Optional task description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-grotesk text-text-muted block mb-1">Assign to</label>
                  <select
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-sans text-text-primary focus:outline-none focus:border-coral/50"
                    value={form.assigned_to}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-grotesk text-text-muted block mb-1">Reward ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-sans text-text-primary focus:outline-none focus:border-coral/50"
                    placeholder="0.00"
                    value={form.reward_amount}
                    onChange={(e) => setForm((f) => ({ ...f, reward_amount: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-grotesk text-text-muted block mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-sans text-text-primary focus:outline-none focus:border-coral/50"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" size="md" className="flex-1" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  isLoading={isCreating}
                  disabled={!form.title.trim() || !form.reward_amount}
                  onClick={handleCreate}
                >
                  Create Task
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          className="px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-sm font-sans text-text-primary focus:outline-none focus:border-coral/50 w-56"
          placeholder="Search tasks or workers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {(["all", "open", "in_progress", "submitted", "approved", "rejected"] as FilterTab[]).map((tab) => {
            const count = tab === "all" ? tasks.length : counts[tab as Task["status"]];
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-grotesk font-medium transition-colors ${
                  filter === tab
                    ? "bg-coral text-white"
                    : "bg-bg-elevated text-text-muted hover:text-text-primary border border-border"
                }`}
              >
                {tab === "all" ? "All" : STATUS_LABELS[tab as Task["status"]]}
                <span className={`ml-1.5 ${filter === tab ? "text-white/70" : "text-text-disabled"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid gap-6 ${selectedTask ? "lg:grid-cols-[1fr_380px]" : "grid-cols-1"}`}>
        {/* Task list */}
        <Card>
          {filteredTasks.length === 0 ? (
            <p className="text-text-disabled font-sans text-sm py-4">No tasks found.</p>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask((prev) => (prev?.id === task.id ? null : task))}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedTask?.id === task.id
                      ? "bg-coral/5 border-coral/30"
                      : "bg-bg-elevated border-border/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-sans font-medium text-text-primary text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant={STATUS_VARIANTS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
                        <span className="text-xs font-grotesk text-text-disabled">
                          {formatCurrency(task.reward_amount)}
                        </span>
                        {task.profiles?.full_name && (
                          <span className="text-xs font-grotesk text-text-disabled">
                            → {task.profiles.full_name}
                          </span>
                        )}
                        {task.deadline && (
                          <span className="text-xs font-grotesk text-text-disabled">
                            due {formatRelativeTime(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.status === "submitted" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="lime"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleApprove(task); }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleReject(task); }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Detail panel */}
        {selectedTask && (
          <div className="animate-fade_in">
            <Card>
              <CardHeader>
                <CardTitle>Task Detail</CardTitle>
                <button onClick={() => setSelectedTask(null)} className="text-text-muted hover:text-text-primary text-sm">✕</button>
              </CardHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-grotesk text-text-muted mb-1">Title</p>
                  <p className="font-sans font-medium text-text-primary">{selectedTask.title}</p>
                </div>

                {selectedTask.description && (
                  <div>
                    <p className="text-xs font-grotesk text-text-muted mb-1">Description</p>
                    <p className="font-sans text-sm text-text-muted leading-relaxed">{selectedTask.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted">Reward</p>
                    <p className="font-sora font-bold text-coral mt-0.5">{formatCurrency(selectedTask.reward_amount)}</p>
                  </div>
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted">Status</p>
                    <div className="mt-1">
                      <Badge variant={STATUS_VARIANTS[selectedTask.status]}>{STATUS_LABELS[selectedTask.status]}</Badge>
                    </div>
                  </div>
                </div>

                {selectedTask.profiles && (
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted mb-1">Assigned to</p>
                    <p className="font-sans text-sm text-text-primary">{selectedTask.profiles.full_name}</p>
                    <p className="text-xs text-text-disabled">{selectedTask.profiles.email}</p>
                  </div>
                )}

                {selectedTask.deadline && (
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted mb-1">Deadline</p>
                    <p className="font-sans text-sm text-text-primary">
                      {new Date(selectedTask.deadline).toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-text-disabled mt-0.5">{formatRelativeTime(selectedTask.deadline)}</p>
                  </div>
                )}

                {selectedTask.submitted_at && (
                  <div className="p-3 bg-lavender/5 border border-lavender/20 rounded-lg">
                    <p className="text-xs font-grotesk text-lavender mb-1">Submitted</p>
                    <p className="font-sans text-sm text-text-primary">
                      {new Date(selectedTask.submitted_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}

                {selectedTask.status === "submitted" && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="lime"
                      size="md"
                      className="flex-1"
                      isLoading={isActing}
                      onClick={() => handleApprove(selectedTask)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      className="flex-1"
                      isLoading={isActing}
                      onClick={() => handleReject(selectedTask)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
