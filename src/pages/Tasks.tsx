import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore, useTaskStore } from "@/lib/store";
import { fetchUserTasks, updateTaskStatus } from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Task } from "@/types";

const STATUS_ORDER: Task["status"][] = ["open", "in_progress", "submitted", "approved", "rejected"];

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

type FilterTab = Task["status"] | "all";

export function Tasks() {
  const { profile } = useAuthStore();
  const { tasks, setTasks, updateTask } = useTaskStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchUserTasks(profile.id).then(({ data }) => {
      if (data) setTasks(data);
      setIsLoading(false);
    });
  }, [profile, setTasks]);

  useRealtime<{ new: Task; old: Task }>(
    `tasks-worker:${profile?.id}`,
    {
      table: "tasks",
      event: "UPDATE",
      filter: profile ? `assigned_to=eq.${profile.id}` : undefined,
      enabled: !!profile,
    },
    (payload) => {
      updateTask(payload.new.id, payload.new);
      setSelectedTask((prev) => (prev?.id === payload.new.id ? payload.new : prev));
    }
  );

  const filteredTasks = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  const counts = STATUS_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s).length }),
    {} as Record<Task["status"], number>
  );

  const handleAction = async (task: Task) => {
    if (isActing) return;
    setIsActing(true);

    let nextStatus: Task["status"] | null = null;
    if (task.status === "open") nextStatus = "in_progress";
    else if (task.status === "in_progress") nextStatus = "submitted";

    if (nextStatus) {
      updateTask(task.id, {
        status: nextStatus,
        ...(nextStatus === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
      });
      try {
        await updateTaskStatus(task.id, nextStatus);
        setSelectedTask((prev) => (prev?.id === task.id ? { ...prev, status: nextStatus! } : prev));
      } catch {
        toast("Failed to update task. Please try again.", "error");
        // revert optimistic update
        updateTask(task.id, { status: task.status });
      }
    }
    setIsActing(false);
  };

  const totalEarned = tasks
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.reward_amount, 0);

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-bg-elevated rounded-lg animate-pulse" />
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora font-semibold text-2xl text-text-primary">My Tasks</h1>
          <p className="text-text-muted font-sans text-sm mt-0.5">
            {tasks.length} total · {formatCurrency(totalEarned)} earned from approved tasks
          </p>
        </div>
        <Badge variant="success">
          {counts.approved} approved
        </Badge>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", ...STATUS_ORDER] as FilterTab[]).map((tab) => {
          const count = tab === "all" ? tasks.length : counts[tab];
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
              {tab === "all" ? "All" : STATUS_LABELS[tab]}
              <span className={`ml-1.5 ${filter === tab ? "text-white/70" : "text-text-disabled"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`grid gap-6 ${selectedTask ? "lg:grid-cols-[1fr_380px]" : "grid-cols-1"}`}>
        {/* Task list */}
        <Card>
          {filteredTasks.length === 0 ? (
            <p className="text-text-disabled font-sans text-sm py-4">
              No tasks in this category.
            </p>
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
                      <p className="font-sans font-medium text-text-primary text-sm truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant={STATUS_VARIANTS[task.status]}>
                          {STATUS_LABELS[task.status]}
                        </Badge>
                        <span className="text-xs font-grotesk text-text-disabled">
                          {formatCurrency(task.reward_amount)} reward
                        </span>
                        {task.deadline && (
                          <span className="text-xs font-grotesk text-text-disabled">
                            due {formatRelativeTime(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    {(task.status === "open" || task.status === "in_progress") && (
                      <Button
                        variant={task.status === "open" ? "secondary" : "primary"}
                        size="sm"
                        isLoading={isActing && selectedTask?.id === task.id}
                        onClick={(e) => { e.stopPropagation(); handleAction(task); }}
                      >
                        {task.status === "open" ? "Start" : "Submit"}
                      </Button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Task detail panel */}
        {selectedTask && (
          <div className="space-y-4 animate-fade_in">
            <Card>
              <CardHeader>
                <CardTitle>Task Details</CardTitle>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-text-muted hover:text-text-primary text-sm"
                >
                  ✕
                </button>
              </CardHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-grotesk text-text-muted mb-1">Title</p>
                  <p className="font-sans font-medium text-text-primary">{selectedTask.title}</p>
                </div>

                {selectedTask.description && (
                  <div>
                    <p className="text-xs font-grotesk text-text-muted mb-1">Description</p>
                    <p className="font-sans text-sm text-text-muted leading-relaxed">
                      {selectedTask.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted">Reward</p>
                    <p className="font-sora font-bold text-coral mt-0.5">
                      {formatCurrency(selectedTask.reward_amount)}
                    </p>
                  </div>
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted">Status</p>
                    <div className="mt-1">
                      <Badge variant={STATUS_VARIANTS[selectedTask.status]}>
                        {STATUS_LABELS[selectedTask.status]}
                      </Badge>
                    </div>
                  </div>
                </div>

                {selectedTask.deadline && (
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border/50">
                    <p className="text-xs font-grotesk text-text-muted">Deadline</p>
                    <p className="font-sans text-sm text-text-primary mt-0.5">
                      {new Date(selectedTask.deadline).toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-text-disabled mt-0.5">
                      {formatRelativeTime(selectedTask.deadline)}
                    </p>
                  </div>
                )}

                {/* Progress steps */}
                <div>
                  <p className="text-xs font-grotesk text-text-muted mb-3">Progress</p>
                  <div className="flex items-center gap-1">
                    {STATUS_ORDER.slice(0, 4).map((s, i) => {
                      const currentIdx = STATUS_ORDER.indexOf(selectedTask.status);
                      const stepIdx = STATUS_ORDER.indexOf(s);
                      const done = stepIdx <= currentIdx && selectedTask.status !== "rejected";
                      return (
                        <div key={s} className="flex items-center gap-1 flex-1">
                          <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                            done ? "bg-lime" : "bg-border"
                          }`} />
                          {i < 3 && (
                            <div className={`h-px flex-1 transition-colors ${
                              stepIdx < currentIdx && selectedTask.status !== "rejected"
                                ? "bg-lime"
                                : "bg-border"
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    {["Open", "Started", "Submitted", "Approved"].map((label) => (
                      <span key={label} className="text-xs font-grotesk text-text-disabled">{label}</span>
                    ))}
                  </div>
                </div>

                {(selectedTask.status === "open" || selectedTask.status === "in_progress") && (
                  <Button
                    variant={selectedTask.status === "open" ? "secondary" : "primary"}
                    size="md"
                    className="w-full"
                    isLoading={isActing}
                    onClick={() => handleAction(selectedTask)}
                  >
                    {selectedTask.status === "open" ? "Start Task" : "Submit for Review"}
                  </Button>
                )}

                {selectedTask.status === "rejected" && (
                  <div className="p-3 bg-coral/5 border border-coral/20 rounded-lg">
                    <p className="text-xs font-sans text-coral">
                      This task was not approved. Contact your admin for details.
                    </p>
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
