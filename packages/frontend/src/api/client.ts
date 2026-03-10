import type { UploadResponse, PlanRequest, PlanResponse } from '@gala-planner/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function generatePlan(request: PlanRequest): Promise<PlanResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Plan generation failed',
    };
  }
}
