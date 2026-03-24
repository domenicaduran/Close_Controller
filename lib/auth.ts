import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { UserRole, type User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "close_controller_session";
const SESSION_DURATION_DAYS = 30;

function hashValue(value: string, salt: string) {
  return scryptSync(value, salt, 64).toString("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashValue(password, salt)}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const derived = Buffer.from(hashValue(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (derived.length !== expected.length) return false;

  return timingSafeEqual(derived, expected);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashValue(token, "close-controller-session");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.userSession.deleteMany({
      where: {
        tokenHash: hashValue(token, "close-controller-session"),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: {
      tokenHash: hashValue(token, "close-controller-session"),
    },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    cookieStore.delete(SESSION_COOKIE);
    if (session) {
      await prisma.userSession.delete({
        where: { tokenHash: session.tokenHash },
      });
    }
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(user: Pick<User, "role">) {
  return user.role === UserRole.ADMIN;
}

export function isManager(user: Pick<User, "role">) {
  return user.role === UserRole.MANAGER;
}

export function isManagerOrAdmin(user: Pick<User, "role">) {
  return isAdmin(user) || isManager(user);
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) {
    redirect("/");
  }

  return user;
}

export async function requireManagerOrAdmin() {
  const user = await requireUser();
  if (!isManagerOrAdmin(user)) {
    redirect("/");
  }

  return user;
}

export async function accessibleClientIdsForUser(user: Pick<User, "id" | "role">) {
  if (isAdmin(user)) {
    const clients = await prisma.client.findMany({
      select: { id: true },
    });

    return clients.map((client) => client.id);
  }

  const memberships = await prisma.clientUserAccess.findMany({
    where: { userId: user.id },
    select: { clientId: true },
  });

  return memberships.map((membership) => membership.clientId);
}

export async function requireClientAccess(clientId: string) {
  const user = await requireUser();

  if (isAdmin(user)) {
    return user;
  }

  const membership = await prisma.clientUserAccess.findUnique({
    where: {
      clientId_userId: {
        clientId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    redirect("/");
  }

  return user;
}

export async function requireClientManagementAccess(clientId: string) {
  const user = await requireManagerOrAdmin();

  if (isAdmin(user)) {
    return user;
  }

  const membership = await prisma.clientUserAccess.findUnique({
    where: {
      clientId_userId: {
        clientId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    redirect("/");
  }

  return user;
}

export async function findUserByOwnerLabel(owner?: string | null) {
  const normalized = owner?.trim();
  if (!normalized) return null;

  return prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { email: normalized.toLowerCase() },
        { name: normalized },
      ],
    },
  });
}

export async function ensureActiveUserChoices() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}
