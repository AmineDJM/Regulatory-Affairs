"use client";

import * as React from "react";
import { Loader2, KeyRound, Check, ShieldAlert, ShieldCheck, LogOut } from "lucide-react";
import {
  adminResetPassword, revokeAllSessions, setUserActive, updateUserProfile,
} from "@/lib/actions/access-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/labels";

interface Profile {
  id: string; name: string; title: string; region: string; role: string;
}

export function ProfileForm({ user }: { user: Profile }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  return (
    <form
      action={async (fd) => { setSaving(true); await updateUserProfile(fd); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500); }}
      className="grid grid-cols-2 gap-3"
    >
      <input type="hidden" name="userId" value={user.id} />
      <div className="space-y-1"><Label htmlFor="name">Nom</Label><Input id="name" name="name" defaultValue={user.name} /></div>
      <div className="space-y-1"><Label htmlFor="role">Rôle (défaut)</Label>
        <Select id="role" name="role" defaultValue={user.role}>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div className="space-y-1"><Label htmlFor="title">Fonction</Label><Input id="title" name="title" defaultValue={user.title} /></div>
      <div className="space-y-1"><Label htmlFor="region">Région</Label><Input id="region" name="region" defaultValue={user.region} /></div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
          {saved ? "Enregistré" : "Enregistrer le profil"}
        </Button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [pw, setPw] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
    setPw(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  }

  return (
    <form
      action={async (fd) => { setSaving(true); const r = await adminResetPassword(fd); setSaving(false); if (r.ok) setDone(true); }}
      className="space-y-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <Label htmlFor="password">Nouveau mot de passe</Label>
      <div className="flex gap-2">
        <Input id="password" name="password" value={pw} onChange={(e) => { setPw(e.target.value); setDone(false); }} placeholder="min. 8 caractères" />
        <Button type="button" variant="outline" onClick={generate}>Générer</Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mustChange" defaultChecked className="h-4 w-4 rounded border-input" />
        Forcer le changement à la prochaine connexion
      </label>
      <Button type="submit" variant="destructive" disabled={saving || pw.length < 8}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Réinitialiser
      </Button>
      {done && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Mot de passe défini. Communiquez-le à l’utilisateur&nbsp;: <code className="font-mono">{pw}</code>
          <br />Toutes ses sessions ont été révoquées.
        </p>
      )}
    </form>
  );
}

export function ActiveToggle({ userId, isActive, isSelf }: { userId: string; isActive: boolean; isSelf: boolean }) {
  return (
    <form action={async (fd) => { await setUserActive(fd); }}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={(!isActive).toString()} />
      <Button type="submit" variant={isActive ? "outline" : "success"} disabled={isSelf} title={isSelf ? "Vous ne pouvez pas vous désactiver" : ""}>
        {isActive ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {isActive ? "Désactiver le compte" : "Activer le compte"}
      </Button>
    </form>
  );
}

export function RevokeAllButton({ userId }: { userId: string }) {
  return (
    <form action={async (fd) => { await revokeAllSessions(fd); }}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="outline" size="sm">
        <LogOut className="h-4 w-4" /> Déconnecter partout
      </Button>
    </form>
  );
}
