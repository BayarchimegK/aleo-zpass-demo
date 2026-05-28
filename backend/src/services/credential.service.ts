import { prisma } from "../db/prisma";

export const issueCredential = async (
  holderEmail: string,
  age: number,
  country: string,
) => {
  return prisma.credential.create({
    data: {
      holderEmail,
      age,
      country,
    },
  });
};

export const getCredential = async (id: number) => {
  return prisma.credential.findUnique({ where: { id } });
};

export const getCredentialByEmail = async (holderEmail: string) => {
  return prisma.credential.findFirst({
    where: { holderEmail },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      holderEmail: true,
      country: true,
      issuedAt: true,
      isRevoked: true,
      revokedAt: true,
      // age intentionally omitted — never expose to the frontend
    },
  });
};

export const revokeCredential = async (id: number) => {
  return prisma.credential.update({
    where: { id },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      // invalidate cached proof so re-verification would be forced
      proofExpiresAt: null,
    },
  });
};

export const listCredentials = async () => {
  return prisma.credential.findMany({
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      holderEmail: true,
      country: true,
      issuedAt: true,
      isRevoked: true,
      revokedAt: true,
      proofExpiresAt: true,
      // intentionally omit `age` — not needed by the issuer UI
    },
  });
};

export const deleteCredential = async (id: number) => {
  return prisma.credential.delete({ where: { id } });
};
