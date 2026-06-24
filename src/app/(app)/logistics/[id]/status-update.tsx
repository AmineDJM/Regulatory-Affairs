"use client";

import * as React from "react";
import { Loader2, Check } from "lucide-react";
import { updateLogisticsStatus } from "@/lib/actions/logistics-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { LOGISTICS_STATUS } from "@/lib/labels";

interface Props {
  id: string;
  status: string;
  actualDeparture: string | null;
  actualArrival: string | null;
  customsDate: string | null;
  pchDeliveryDate: string | null;
  quantityReceived: number;
}

export function StatusUpdate(props: Props) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await updateLogisticsStatus(fd);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
      className="grid grid-cols-2 gap-3"
    >
      <input type="hidden" name="id" value={props.id} />
      <div className="col-span-2 space-y-1">
        <Label htmlFor="status">Statut</Label>
        <Select id="status" name="status" defaultValue={props.status}>
          {Object.entries(LOGISTICS_STATUS).map(([v, d]) => (
            <option key={v} value={v}>{d.label}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="actualDeparture">Départ réel</Label>
        <Input id="actualDeparture" name="actualDeparture" type="date" defaultValue={props.actualDeparture?.slice(0, 10) ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="actualArrival">Arrivée réelle</Label>
        <Input id="actualArrival" name="actualArrival" type="date" defaultValue={props.actualArrival?.slice(0, 10) ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="customsDate">Dédouanement</Label>
        <Input id="customsDate" name="customsDate" type="date" defaultValue={props.customsDate?.slice(0, 10) ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pchDeliveryDate">Livraison PCH</Label>
        <Input id="pchDeliveryDate" name="pchDeliveryDate" type="date" defaultValue={props.pchDeliveryDate?.slice(0, 10) ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quantityReceived">Quantité reçue</Label>
        <Input id="quantityReceived" name="quantityReceived" type="number" defaultValue={props.quantityReceived} />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
          {saved ? "Enregistré" : "Mettre à jour"}
        </Button>
      </div>
    </form>
  );
}
