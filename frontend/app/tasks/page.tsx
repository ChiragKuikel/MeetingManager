// app/tasks/page.tsx
'use client';

import React from 'react';
import TaskList from '@/components/TaskList';

export default function TasksPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <TaskList />
    </div>
  );
}
