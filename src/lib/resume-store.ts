import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ResumeProfile,
  ResumeData,
  ResumeFormat,
  ResumeSection,
  SectionEntry,
  PersonalInfo,
  SectionType,
  createDefaultProfile,
  createEntry,
  createSection,
  DEFAULT_FORMAT,
} from "./resume-types";

interface ResumeStore {
  // Profiles
  profiles: ResumeProfile[];
  activeProfileId: string | null;

  // Computed
  getActiveProfile: () => ResumeProfile | null;

  // Profile actions
  createProfile: (name: string) => string;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  switchProfile: (id: string) => void;
  duplicateProfile: (id: string, name: string) => string;

  // Data actions (operate on active profile)
  updatePersonal: (partial: Partial<PersonalInfo>) => void;
  updateSummary: (summary: string) => void;
  addSection: (type: SectionType) => void;
  removeSection: (sectionId: string) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  addEntry: (sectionId: string, partial?: Partial<SectionEntry>) => void;
  updateEntry: (sectionId: string, entryId: string, partial: Partial<SectionEntry>) => void;
  removeEntry: (sectionId: string, entryId: string) => void;
  moveEntry: (sectionId: string, entryId: string, direction: "up" | "down") => void;
  addBullet: (sectionId: string, entryId: string) => void;
  updateBullet: (sectionId: string, entryId: string, index: number, text: string) => void;
  removeBullet: (sectionId: string, entryId: string, index: number) => void;

  // Format actions
  updateFormat: (partial: Partial<ResumeFormat>) => void;
  resetFormat: () => void;

  // Import/Export
  exportProfile: (id: string) => string;
  importProfile: (json: string) => string | null;
}

function updateActiveData(
  profiles: ResumeProfile[],
  activeId: string | null,
  updater: (data: ResumeData) => ResumeData
): ResumeProfile[] {
  return profiles.map((p) => {
    if (p.id === activeId) {
      return { ...p, data: updater(p.data), updatedAt: Date.now() };
    }
    return p;
  });
}

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        return profiles.find((p) => p.id === activeProfileId) ?? null;
      },

      createProfile: (name: string) => {
        const profile = createDefaultProfile(name);
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: profile.id,
        }));
        return profile.id;
      },

      deleteProfile: (id: string) => {
        set((s) => {
          const remaining = s.profiles.filter((p) => p.id !== id);
          const newActive = s.activeProfileId === id
            ? (remaining[0]?.id ?? null)
            : s.activeProfileId;
          return { profiles: remaining, activeProfileId: newActive };
        });
      },

      renameProfile: (id: string, name: string) => {
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)),
        }));
      },

      switchProfile: (id: string) => {
        set({ activeProfileId: id });
      },

      duplicateProfile: (id: string, name: string) => {
        const source = get().profiles.find((p) => p.id === id);
        if (!source) return "";
        const newProfile: ResumeProfile = {
          ...source,
          id: crypto.randomUUID(),
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({
          profiles: [...s.profiles, newProfile],
          activeProfileId: newProfile.id,
        }));
        return newProfile.id;
      },

      updatePersonal: (partial) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            personal: { ...d.personal, ...partial },
          })),
        }));
      },

      updateSummary: (summary) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            summary,
          })),
        }));
      },

      addSection: (type) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: [...d.sections, createSection(type)],
          })),
        }));
      },

      removeSection: (sectionId) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.filter((sec) => sec.id !== sectionId),
          })),
        }));
      },

      updateSectionTitle: (sectionId, title) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) => (sec.id === sectionId ? { ...sec, title } : sec)),
          })),
        }));
      },

      toggleSectionVisibility: (sectionId) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId ? { ...sec, visible: !sec.visible } : sec
            ),
          })),
        }));
      },

      moveSection: (sectionId, direction) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => {
            const sections = [...d.sections];
            const idx = sections.findIndex((sec) => sec.id === sectionId);
            if (idx === -1) return d;
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= sections.length) return d;
            [sections[idx], sections[swapIdx]] = [sections[swapIdx], sections[idx]];
            return { ...d, sections };
          }),
        }));
      },

      addEntry: (sectionId, partial) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId ? { ...sec, entries: [...sec.entries, createEntry(partial)] } : sec
            ),
          })),
        }));
      },

      updateEntry: (sectionId, entryId, partial) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId
                ? {
                    ...sec,
                    entries: sec.entries.map((e) =>
                      e.id === entryId ? { ...e, ...partial } : e
                    ),
                  }
                : sec
            ),
          })),
        }));
      },

      removeEntry: (sectionId, entryId) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, entries: sec.entries.filter((e) => e.id !== entryId) }
                : sec
            ),
          })),
        }));
      },

      moveEntry: (sectionId, entryId, direction) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) => {
              if (sec.id !== sectionId) return sec;
              const entries = [...sec.entries];
              const idx = entries.findIndex((e) => e.id === entryId);
              if (idx === -1) return sec;
              const swapIdx = direction === "up" ? idx - 1 : idx + 1;
              if (swapIdx < 0 || swapIdx >= entries.length) return sec;
              [entries[idx], entries[swapIdx]] = [entries[swapIdx], entries[idx]];
              return { ...sec, entries };
            }),
          })),
        }));
      },

      addBullet: (sectionId, entryId) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId
                ? {
                    ...sec,
                    entries: sec.entries.map((e) =>
                      e.id === entryId ? { ...e, bullets: [...e.bullets, ""] } : e
                    ),
                  }
                : sec
            ),
          })),
        }));
      },

      updateBullet: (sectionId, entryId, index, text) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId
                ? {
                    ...sec,
                    entries: sec.entries.map((e) =>
                      e.id === entryId
                        ? { ...e, bullets: e.bullets.map((b, i) => (i === index ? text : b)) }
                        : e
                    ),
                  }
                : sec
            ),
          })),
        }));
      },

      removeBullet: (sectionId, entryId, index) => {
        set((s) => ({
          profiles: updateActiveData(s.profiles, s.activeProfileId, (d) => ({
            ...d,
            sections: d.sections.map((sec) =>
              sec.id === sectionId
                ? {
                    ...sec,
                    entries: sec.entries.map((e) =>
                      e.id === entryId
                        ? { ...e, bullets: e.bullets.filter((_, i) => i !== index) }
                        : e
                    ),
                  }
                : sec
            ),
          })),
        }));
      },

      updateFormat: (partial) => {
        set((s) => ({
          profiles: s.profiles.map((p) => {
            if (p.id !== s.activeProfileId) return p;
            return { ...p, format: { ...p.format, ...partial } as ResumeFormat, updatedAt: Date.now() };
          }),
        }));
      },

      resetFormat: () => {
        set((s) => ({
          profiles: s.profiles.map((p) => {
            if (p.id !== s.activeProfileId) return p;
            return { ...p, format: { ...DEFAULT_FORMAT }, updatedAt: Date.now() };
          }),
        }));
      },

      exportProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return "{}";
        return JSON.stringify(profile, null, 2);
      },

      importProfile: (json) => {
        try {
          const parsed = JSON.parse(json) as ResumeProfile;
          if (!parsed.name || !parsed.data) return null;
          const newProfile: ResumeProfile = {
            ...parsed,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set((s) => ({
            profiles: [...s.profiles, newProfile],
            activeProfileId: newProfile.id,
          }));
          return newProfile.id;
        } catch {
          return null;
        }
      },
    }),
    {
      name: "resume-builder-storage",
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
      }),
    }
  )
);
