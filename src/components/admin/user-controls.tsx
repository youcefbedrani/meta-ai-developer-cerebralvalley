"use client";

import { useState } from "react";
import { adjustCreditsAction, deleteUserAction, marketplaceBanAction, setPlanAction, suspendUserAction } from "@/app/(app)/app/admin/actions";
import { useRun } from "@/components/marketplace/use-run";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Target = { id: string; email: string; plan: string; role: string; suspended: boolean; banned: boolean; isSelf: boolean; envAdmin: boolean; marketplace: boolean };

export function PlanRoleControls({ user }: { user: Target }) {
  const { run, pending } = useRun();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="admin-plan">Plan</Label>
        <select id="admin-plan" defaultValue={user.plan} disabled={pending} onChange={(e) => run(() => setPlanAction(user.id, e.target.value), "Plan updated")} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-white px-2 text-sm">
          <option value="free">Free</option>
          <option value="founder">Founder</option>
          <option value="studio">Studio</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">Manual override. It doesn&apos;t create or cancel a Stripe subscription.</p>
      </div>
      <div>
        <p className="text-sm font-medium">Admin access</p>
        <p className="mt-1.5 text-sm">{user.envAdmin ? "Yes: platform team" : "No: client account"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Only emails in the server&apos;s ADMIN_EMAILS setting are admins. It can&apos;t be changed from the app.</p>
      </div>
    </div>
  );
}

export function CreditControls({ userId }: { userId: string }) {
  const { run, pending, router } = useRun();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const amount = Number(delta);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="credit-delta">Credits (+ add, − remove)</Label>
        <Input id="credit-delta" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="50" className="mt-1.5 h-9 w-36" />
      </div>
      <div className="min-w-56 flex-1">
        <Label htmlFor="credit-reason">Reason for the change</Label>
        <Input id="credit-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goodwill after a failed job" className="mt-1.5 h-9" />
      </div>
      <Button
        size="sm"
        variant="gradient"
        disabled={pending || !Number.isInteger(amount) || amount === 0 || reason.trim().length < 3}
        onClick={() => run(() => adjustCreditsAction(userId, amount, reason), amount > 0 ? `Added ${amount} credits` : `Removed ${-amount} credits`, () => {
          setDelta("");
          setReason("");
          router.refresh();
        })}
      >
        Apply
      </Button>
      <p className="w-full text-xs text-muted-foreground">Added credits never expire. Removed credits come out of this month&apos;s balance.</p>
    </div>
  );
}

export function AccessControls({ user }: { user: Target }) {
  const { run, pending, router } = useRun();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Account access</p>
        {user.suspended ? (
          <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => run(() => suspendUserAction(user.id, false), "Suspension lifted")}>Lift suspension</Button>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <Input aria-label="Suspension reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the user at sign-in)" className="h-9 min-w-56 flex-1" disabled={user.isSelf} />
            <Button size="sm" variant="destructive" disabled={pending || user.isSelf || reason.trim().length < 3} onClick={() => run(() => suspendUserAction(user.id, true, reason), "User suspended")}>Suspend account</Button>
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">A suspended user is signed out everywhere and can&apos;t sign in until you lift it. Their data is kept.</p>
      </div>
      {user.marketplace ? (
        <div>
          <p className="text-sm font-medium">Marketplace</p>
          <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => run(() => marketplaceBanAction(user.id, !user.banned), user.banned ? "Marketplace ban lifted" : "Banned from the marketplace")}>
            {user.banned ? "Lift marketplace ban" : "Ban from marketplace"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">Banning also takes down their live listings.</p>
        </div>
      ) : null}
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <p className="text-sm font-medium text-red-800">Delete account</p>
        <p className="mt-1 text-xs text-red-800/80">Permanently deletes the sign-in and every project, report and page this user owns. This can&apos;t be undone. Not possible for users with marketplace deals.</p>
        {showDelete ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input aria-label="Type the email to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={user.email} className="h-9 min-w-56 flex-1 bg-white" />
            <Button size="sm" variant="destructive" disabled={pending || confirm.trim().toLowerCase() !== user.email.toLowerCase()} onClick={() => run(() => deleteUserAction(user.id, confirm), "Account deleted", () => router.replace("/app/admin/users"))}>
              Delete permanently
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="destructive" className="mt-3" disabled={user.isSelf} onClick={() => setShowDelete(true)}>Delete account…</Button>
        )}
      </div>
    </div>
  );
}
