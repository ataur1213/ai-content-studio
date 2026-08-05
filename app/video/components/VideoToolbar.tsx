
"use client";

// =============================================================================
// Video Studio UI — Video Toolbar Component
// =============================================================================

import type { JobState, JobPriority } from "@/app/lib/video/types";

interface VideoToolbarProps {
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly statusFilter: JobState | "all";
  readonly onStatusFilterChange: (status: JobState | "all") => void;
  readonly priorityFilter: JobPriority | "all";
  readonly onPriorityFilterChange: (priority: JobPriority | "all") => void;
  readonly sortBy: "createdAt" | "name";
  readonly onSortByChange: (sortBy: "createdAt" | "name") => void;
  readonly onRefresh: () => void;
  readonly onClearFilters: () => void;
}

const JOB_STATES: readonly (JobState | "all")[] = ["all", "queued", "pending", "processing", "completed", "failed", "cancelled", "retrying", "timeout"];
const JOB_PRIORITIES: readonly (JobPriority | "all")[] = ["all", "low", "normal", "high", "critical"];
const SORT_OPTIONS: readonly { readonly value: "createdAt" | "name"; readonly label: string }[] = [
  { value: "createdAt", label: "Date Created" },
  { value: "name", label: "Name" }
];

export function VideoToolbar({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
  onRefresh,
  onClearFilters
}: VideoToolbarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as JobState | "all")}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {JOB_STATES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All Statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value as JobPriority | "all")}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {JOB_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority === "all" ? "All Priorities" : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Selector */}
        <div>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as "createdAt" | "name")}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={onClearFilters}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
