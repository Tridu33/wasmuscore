// File: src/stores/tabs.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { uploadGpFile, fetchAllTabs, fetchTabFile, searchTabs as apiSearchTabs } from '~/services/api'
import { parseGpFile } from '~/utils/guitarpro/parser'
import type { GpTabRecord, GpSong } from '~/utils/guitarpro/types'

export const useTabsStore = defineStore('tabs', () => {
  // State
  const tabs = ref<GpTabRecord[]>([])
  const currentTab = ref<GpTabRecord | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const parsedMetadata = ref<GpSong | null>(null)

  // Load all tabs from backend
  async function loadTabs() {
    isLoading.value = true
    error.value = null
    try {
      tabs.value = await fetchAllTabs()
    }
    catch (e: any) {
      error.value = `Failed to load tabs: ${e.message}`
    }
    finally {
      isLoading.value = false
    }
  }

  // Upload a GP file (parses metadata locally + saves to backend)
  async function uploadTab(file: File): Promise<GpSong | null> {
    isLoading.value = true
    error.value = null
    let parsed: GpSong | null = null

    try {
      // Pre-parse for immediate metadata display
      parsed = await parseGpFile(file)
      parsedMetadata.value = parsed

      // Upload to backend
      const record = await uploadGpFile(file)
      tabs.value.unshift(record)
    }
    catch (e: any) {
      error.value = `Failed to upload tab: ${e.message}`
    }
    finally {
      isLoading.value = false
    }

    return parsed
  }

  // Download a saved tab file and return as File object
  async function downloadTabFile(fileName: string): Promise<File> {
    const blob = await fetchTabFile(fileName)
    return new File([blob], fileName, { type: blob.type })
  }

  // Search tabs
  async function searchTabs(query: string) {
    if (!query.trim()) {
      await loadTabs()
      return
    }
    isLoading.value = true
    error.value = null
    try {
      tabs.value = await apiSearchTabs(query)
    }
    catch (e: any) {
      error.value = `Search failed: ${e.message}`
    }
    finally {
      isLoading.value = false
    }
  }

  // Set current selected tab
  function selectTab(tab: GpTabRecord) {
    currentTab.value = tab
  }

  // Clear parsed metadata
  function clearParsedMetadata() {
    parsedMetadata.value = null
  }

  return {
    tabs,
    currentTab,
    isLoading,
    error,
    searchQuery,
    parsedMetadata,
    loadTabs,
    uploadTab,
    downloadTabFile,
    searchTabs,
    selectTab,
    clearParsedMetadata,
  }
})
