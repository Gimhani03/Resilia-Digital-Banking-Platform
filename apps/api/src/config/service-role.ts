/**
 * Route partitioning across independently deployed API services.
 *
 * Every container runs the same image and loads every Nest module, which keeps
 * the in-process dependency graph intact (PaymentsService -> FraudService via
 * forwardRef, and -> IdentityService directly). What SERVICE_ROLE changes is
 * which controllers a given container *mounts*. A request for a route this
 * role does not own is a 404 here, and never reaches this container in the
 * first place because nginx routes by prefix to the owning service.
 *
 * SERVICE_ROLE=all (the default) mounts everything — that is the local-dev and
 * docker-compose shape, and the fallback if the variable is ever unset.
 */

export const SERVICE_ROLES = {
  core: ["auth", "accounts", "audit", "notifications"],
  payments: ["payments", "fraud", "cards", "loans", "ops"],
} as const;

export type ServiceRole = keyof typeof SERVICE_ROLES | "all";

export function currentRole(): ServiceRole {
  const raw = (process.env.SERVICE_ROLE || "all").trim().toLowerCase();
  return raw in SERVICE_ROLES ? (raw as ServiceRole) : "all";
}

/** Routes this container answers. `health` is always mounted, on every role. */
export function ownedRoutes(): string[] {
  const role = currentRole();
  if (role === "all") return Object.values(SERVICE_ROLES).flat();
  return [...SERVICE_ROLES[role]];
}

export function exposes(route: string): boolean {
  return currentRole() === "all" || ownedRoutes().includes(route);
}

/**
 * Used in a module's `controllers:` array. Returns the controllers when this
 * role owns the route, and an empty array when it does not.
 */
export function controllersFor<T>(route: string, controllers: T[]): T[] {
  return exposes(route) ? controllers : [];
}
