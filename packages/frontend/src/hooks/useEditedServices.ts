import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ParseResult, Service, Locomotive, Station } from '@gala-planner/shared';
import { randomUUID } from '../utils/uuid';

const STORAGE_KEY_PREFIX = 'gala-planner-edits-';

/**
 * Check if an update actually changes any values on the service
 */
function hasActualChanges(service: Service, updates: Partial<Service>): boolean {
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = service[key as keyof Service];
    // Compare arrays by JSON (for locomotiveIds, serviceNotes)
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) return true;
    } else if (oldValue !== newValue) {
      return true;
    }
  }
  return false;
}

/**
 * Hook for managing edited services with localStorage persistence.
 * Allows users to modify parsed timetable data and persist changes across sessions.
 */
export function useEditedServices(originalResult: ParseResult) {
  const storageKey = `${STORAGE_KEY_PREFIX}${originalResult.id}`;

  // Initialize state from localStorage or use original result
  const [editedResult, setEditedResult] = useState<ParseResult>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ParseResult;
        // Verify it matches the same original file
        if (parsed.id === originalResult.id) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors, use original
    }
    return originalResult;
  });

  // Persist to localStorage when editedResult changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(editedResult));
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }, [editedResult, storageKey]);

  // Reset to original when a new file is uploaded
  useEffect(() => {
    if (originalResult.id !== editedResult.id) {
      setEditedResult(originalResult);
    }
  }, [originalResult.id, editedResult.id, originalResult]);

  /**
   * Update a single service - only marks as edited if values actually change
   */
  const updateService = useCallback((serviceId: string, updates: Partial<Service>) => {
    setEditedResult((prev) => ({
      ...prev,
      services: prev.services.map((s) => {
        if (s.id !== serviceId) return s;
        // Don't mark as edited if nothing actually changed
        if (!hasActualChanges(s, updates)) return s;
        return {
          ...s,
          ...updates,
          sourceConfidence: 1.0,
          isUserEdited: true,
          // Keep 'added' status if it was user-added, otherwise mark as 'edited'
          editStatus: s.editStatus === 'added' ? 'added' : 'edited',
        };
      }),
    }));
  }, []);

  /**
   * Add a new service
   */
  const addService = useCallback((newService: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'>) => {
    const service: Service = {
      ...newService,
      id: randomUUID(),
      sourceConfidence: 1.0,
      isUserEdited: true,
      editStatus: 'added',
    };

    setEditedResult((prev) => ({
      ...prev,
      services: [...prev.services, service],
    }));

    return service.id;
  }, []);

  /**
   * Soft-delete a service (mark as deleted, still visible in table)
   */
  const deleteService = useCallback((serviceId: string) => {
    setEditedResult((prev) => ({
      ...prev,
      services: prev.services.map((s) =>
        s.id === serviceId
          ? { ...s, editStatus: 'deleted' as const, isUserEdited: true }
          : s
      ),
    }));
  }, []);

  /**
   * Restore a soft-deleted service
   */
  const restoreService = useCallback((serviceId: string) => {
    setEditedResult((prev) => ({
      ...prev,
      services: prev.services.map((s) =>
        s.id === serviceId
          ? { ...s, editStatus: undefined, isUserEdited: false, sourceConfidence: s.sourceConfidence }
          : s
      ),
    }));
  }, []);

  /**
   * Add a new locomotive
   */
  const addLocomotive = useCallback((loco: Locomotive) => {
    setEditedResult((prev) => {
      // Check if loco already exists
      if (prev.locomotives.some((l) => l.id === loco.id)) {
        return prev;
      }
      return {
        ...prev,
        locomotives: [...prev.locomotives, loco],
      };
    });
  }, []);

  /**
   * Remove a locomotive and clear it from any services
   */
  const removeLocomotive = useCallback((locoId: string) => {
    setEditedResult((prev) => ({
      ...prev,
      locomotives: prev.locomotives.filter((l) => l.id !== locoId),
      services: prev.services.map((s) =>
        s.locomotiveIds.includes(locoId)
          ? { ...s, locomotiveIds: s.locomotiveIds.filter((id) => id !== locoId), isUserEdited: true, editStatus: s.editStatus === 'added' ? 'added' as const : 'edited' as const }
          : s
      ),
    }));
  }, []);

  /**
   * Add a new station
   */
  const addStation = useCallback((station: Station) => {
    setEditedResult((prev) => {
      if (prev.stations.some((s) => s.id === station.id)) {
        return prev;
      }
      return {
        ...prev,
        stations: [...prev.stations, station],
      };
    });
  }, []);

  /**
   * Update a station's name or aliases
   */
  const updateStation = useCallback((stationId: string, updates: Partial<Station>) => {
    setEditedResult((prev) => ({
      ...prev,
      stations: prev.stations.map((s) =>
        s.id === stationId ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  /**
   * Remove a station and clear it from any services
   */
  const removeStation = useCallback((stationId: string) => {
    setEditedResult((prev) => ({
      ...prev,
      stations: prev.stations.filter((s) => s.id !== stationId),
      services: prev.services.map((s) => {
        const originChanged = s.originStationId === stationId;
        const destChanged = s.destStationId === stationId;
        if (!originChanged && !destChanged) return s;
        return {
          ...s,
          originStationId: originChanged ? '' : s.originStationId,
          destStationId: destChanged ? '' : s.destStationId,
          isUserEdited: true,
          editStatus: s.editStatus === 'added' ? 'added' as const : 'edited' as const,
        };
      }),
    }));
  }, []);

  /**
   * Reset all edits back to original parsed data
   */
  const resetToOriginal = useCallback(() => {
    setEditedResult(originalResult);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore errors
    }
  }, [originalResult, storageKey]);

  /**
   * Check if there are any user edits
   */
  const hasEdits = editedResult.services.some((s) => s.isUserEdited || s.editStatus)
    || editedResult.locomotives.length !== originalResult.locomotives.length
    || editedResult.stations.length !== originalResult.stations.length;

  /**
   * Active services (not deleted) for use in non-table views
   */
  const activeServices = useMemo(
    () => editedResult.services.filter((s) => s.editStatus !== 'deleted'),
    [editedResult.services]
  );

  return {
    result: editedResult,
    activeServices,
    updateService,
    addService,
    deleteService,
    restoreService,
    addLocomotive,
    removeLocomotive,
    addStation,
    updateStation,
    removeStation,
    resetToOriginal,
    hasEdits,
  };
}
