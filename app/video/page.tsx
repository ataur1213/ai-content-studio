'use client';

// =============================================================================
// Video Studio UI — Page Composition
// =============================================================================

import { useState, useEffect } from 'react';
import { VideoForm } from './components/VideoForm';
import { VideoPreview } from './components/VideoPreview';
import { VideoToolbar } from './components/VideoToolbar';
import { VideoJobList } from './components/VideoJobList';
import { listJobs } from './services/api';
import type { VideoJob, JobState, JobPriority, JobListResponse } from '@/app/lib/video';

export default function VideoPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobState | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [jobs, setJobs] = useState<readonly VideoJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    listJobs()
      .then((response: JobListResponse) => {
        setJobs(response.jobs);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRefresh = () => {
    fetchJobs();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSortBy('createdAt');
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.state === statusFilter;
    const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'createdAt') {
      return b.createdAt.getTime() - a.createdAt.getTime();
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Video Studio</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <VideoForm />
            <VideoPreview preview={undefined} />
          </div>

          <div className="space-y-8">
            <VideoToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriorityFilterChange={setPriorityFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              onRefresh={handleRefresh}
              onClearFilters={handleClearFilters}
            />
            <VideoJobList
              jobs={sortedJobs}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
