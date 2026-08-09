// components/TaskList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineUser,
  HiOutlineCalendar,
} from 'react-icons/hi2';

interface TaskItem {
  id: number;
  task: string;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  status: 'open' | 'done';
  video: { id: number; title: string };
}

type FilterTab = 'all' | 'open' | 'done';

const TaskList = () => {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    fetchTasks(filter);
  }, [filter]);

  const fetchTasks = async (tab: FilterTab) => {
    try {
      setLoading(true);
      setError(null);
      const qs = tab === 'all' ? '' : `?status=${tab}`;
      const response = await fetch(`http://localhost:3001/api/action-items${qs}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `Request failed (${response.status})`);
        return;
      }

      setTasks(data.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (task: TaskItem) =>
    task.status === 'open' && task.dueDate !== null && new Date(task.dueDate) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#35b3c9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Tasks</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#35b3c9' }}>Tasks</h2>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['all', 'open', 'done'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors relative ${
              filter === tab ? 'text-[#35b3c9]' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
            {filter === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#35b3c9]"></div>
            )}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/summary/${task.video.id}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-800">{task.task}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    task.status === 'done' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
                  }`}
                >
                  {task.status.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {task.assignee && (
                  <div className="flex items-center gap-1">
                    <HiOutlineUser className="w-4 h-4" />
                    <span>{task.assignee}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-medium' : ''}`}>
                    <HiOutlineCalendar className="w-4 h-4" />
                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-gray-400">
                  <HiOutlineCheckCircle className="w-4 h-4" />
                  <span>{task.video.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskList;
