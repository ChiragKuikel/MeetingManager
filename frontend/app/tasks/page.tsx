// app/tasks/page.tsx
'use client';

import React from 'react';
import TaskList from '@/components/TaskList';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function TasksPage() {
  useRequireAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <TaskList />
    </div>
  );
}
