"use client";

import React, { useState } from "react";
import { useResumeStore } from "@/lib/resume-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Copy, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImportModal } from "./import-modal";

export function ProfileManager() {
  const { profiles, activeProfileId, createProfile, deleteProfile, renameProfile, switchProfile, duplicateProfile, exportProfile } = useResumeStore();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [dupName, setDupName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showDup, setShowDup] = useState(false);

  const active = profiles.find((p) => p.id === activeProfileId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProfile(newName.trim());
    setNewName("");
    setShowNew(false);
    toast({ title: "Profile created", description: `"${newName.trim()}" is ready` });
  };

  const handleDuplicate = () => {
    if (!activeProfileId || !dupName.trim()) return;
    duplicateProfile(activeProfileId, dupName.trim());
    setDupName("");
    setShowDup(false);
    toast({ title: "Profile duplicated" });
  };

  const handleExport = () => {
    if (!activeProfileId) return;
    const json = exportProfile(activeProfileId);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active?.name || "resume"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Profile saved as JSON" });
  };

  const handleDelete = (id: string) => {
    if (profiles.length <= 1) {
      toast({ title: "Cannot delete", description: "At least one profile required", variant: "destructive" });
      return;
    }
    deleteProfile(id);
    toast({ title: "Profile deleted" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={activeProfileId || ""} onValueChange={switchProfile}>
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue placeholder="Select profile" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8"><Plus className="h-3 w-3" /></Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>New Profile</DialogTitle></DialogHeader>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Profile name (e.g. Google Resume)" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
              <Button size="sm" onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {active && (
        <div className="flex items-center gap-1">
          <Input value={active.name} onChange={(e) => renameProfile(active.id, e.target.value)} className="h-6 text-xs flex-1" />

          <Dialog open={showDup} onOpenChange={setShowDup}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Duplicate"><Copy className="h-3 w-3" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Duplicate Profile</DialogTitle></DialogHeader>
              <Input value={dupName} onChange={(e) => setDupName(e.target.value)} placeholder="New profile name" onKeyDown={(e) => e.key === "Enter" && handleDuplicate()} />
              <DialogFooter>
                <Button size="sm" onClick={handleDuplicate}>Duplicate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExport} title="Export JSON"><Download className="h-3 w-3" /></Button>

          <ImportModal />

          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(active.id)} title="Delete"><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </div>
      )}
    </div>
  );
}
