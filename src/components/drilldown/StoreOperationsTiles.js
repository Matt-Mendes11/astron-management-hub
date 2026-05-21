"use client";

import OpsTile from "./OpsTile";
import { useAuthProfile } from "../../lib/authProfile";

export default function StoreOperationsTiles({ store }) {
  const { isManager } = useAuthProfile();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <OpsTile
        href={`/${store}/routines-and-audits`}
        iconName="clipboard-check"
        title="Routines & Audits"
        description="Daily operational audits"
      />
      <OpsTile
        href={`/${store}/repairs-maintenance`}
        iconName="wrench"
        title="Repairs & Maintenance"
        description="Equipment maintenance"
      />
      <OpsTile href={`/${store}/the-team`} iconName="users" title="The Team" description="Staff management" />
      <OpsTile
        href={`/${store}/fuel-management`}
        iconName="fuel"
        title="Fuel Management"
        description="Fuel planning & inventory"
      />
      {isManager ? (
        <OpsTile
          href={`/${store}/admin-controls-sheet`}
          iconName="cog"
          title="Admin Controls Sheet"
          description="Financial controls & payments"
        />
      ) : null}
    </div>
  );
}
