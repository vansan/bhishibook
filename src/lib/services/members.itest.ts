import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rupeesToPaise } from "@/lib/money";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { disconnect, resetDatabase, seedGroup } from "@/test/db";
import {
  addMember,
  inviteMemberLogin,
  recordDefaultDecision,
  resetMemberPassword,
  updateMember,
} from "./members";

beforeEach(resetDatabase);
afterAll(disconnect);

describe("addMember and updateMember", () => {
  it("adds a member with shares and a hafta", async () => {
    const { group } = await seedGroup();

    const member = await addMember({
      groupId: group.id,
      displayName: "  Ravi Patil  ",
      phone: "9876543210",
      shareCount: 2,
      monthlyHaftaPaise: rupeesToPaise("2000"),
    });

    expect(member.displayName).toBe("Ravi Patil");
    expect(member.shareCount).toBe(2);
  });

  it("rejects nonsense", async () => {
    const { group } = await seedGroup();
    const base = {
      groupId: group.id,
      displayName: "X",
      shareCount: 1,
      monthlyHaftaPaise: rupeesToPaise("1000"),
    };

    await expect(addMember({ ...base, displayName: "  " })).rejects.toThrow(/name/i);
    await expect(addMember({ ...base, shareCount: 0 })).rejects.toThrow(/shares/i);
    await expect(addMember({ ...base, monthlyHaftaPaise: 0 })).rejects.toThrow(/hafta/i);
  });

  it("marks a departing member inactive rather than deleting them", async () => {
    const { group, members } = await seedGroup();

    await updateMember({
      groupId: group.id,
      memberId: members[0].id,
      displayName: members[0].displayName,
      shareCount: 1,
      monthlyHaftaPaise: rupeesToPaise("1000"),
      status: "INACTIVE",
    });

    const after = await prisma.groupMember.findUniqueOrThrow({ where: { id: members[0].id } });
    expect(after.status).toBe("INACTIVE");
    expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(3);
  });

  it("refuses to update a member of another group", async () => {
    const { members } = await seedGroup();
    const other = await seedGroup({ name: "Other", adminEmail: "m1@x.test" });

    await expect(
      updateMember({
        groupId: other.group.id,
        memberId: members[0].id,
        displayName: "Hijacked",
        shareCount: 9,
        monthlyHaftaPaise: rupeesToPaise("1"),
        status: "ACTIVE",
      })
    ).rejects.toThrow();

    const after = await prisma.groupMember.findUniqueOrThrow({ where: { id: members[0].id } });
    expect(after.displayName).not.toBe("Hijacked");
  });
});

describe("recordDefaultDecision", () => {
  it("stores the group's year-end decision and note", async () => {
    const { group, members } = await seedGroup();

    await recordDefaultDecision({
      groupId: group.id,
      memberId: members[0].id,
      decision: "RETURN_PARTIAL",
      note: "Group voted to return half",
    });

    const after = await prisma.groupMember.findUniqueOrThrow({ where: { id: members[0].id } });
    expect(after.defaultDecision).toBe("RETURN_PARTIAL");
    expect(after.defaultNote).toBe("Group voted to return half");
    expect(after.defaultDecidedAt).not.toBeNull();
  });

  it("clears the decided date when set back to pending", async () => {
    const { group, members } = await seedGroup();
    await recordDefaultDecision({
      groupId: group.id,
      memberId: members[0].id,
      decision: "RETURN_NONE",
    });

    await recordDefaultDecision({
      groupId: group.id,
      memberId: members[0].id,
      decision: "PENDING",
    });

    const after = await prisma.groupMember.findUniqueOrThrow({ where: { id: members[0].id } });
    expect(after.defaultDecidedAt).toBeNull();
  });

  it("refuses to write a decision onto another group's member", async () => {
    const { members } = await seedGroup();
    const other = await seedGroup({ name: "Other", adminEmail: "m2@x.test" });

    await expect(
      recordDefaultDecision({
        groupId: other.group.id,
        memberId: members[0].id,
        decision: "RETURN_NONE",
        note: "Not their call",
      })
    ).rejects.toThrow(/could not be found/i);

    const after = await prisma.groupMember.findUniqueOrThrow({ where: { id: members[0].id } });
    expect(after.defaultDecision).toBe("PENDING");
  });
});

describe("inviteMemberLogin", () => {
  it("creates a member login linked to the member row", async () => {
    const { group, members } = await seedGroup();

    const user = await inviteMemberLogin({
      groupId: group.id,
      memberId: members[0].id,
      email: "MemberOne@Test.Local",
      password: "member12345",
      preferredLang: "mr",
    });

    expect(user.role).toBe("MEMBER");
    expect(user.email).toBe("memberone@test.local");
    expect(user.name).toBe(members[0].displayName);
    expect(await verifyPassword("member12345", user.passwordHash)).toBe(true);

    const linked = await prisma.groupMember.findUniqueOrThrow({ where: { id: members[0].id } });
    expect(linked.userId).toBe(user.id);
    expect(linked.email).toBe("memberone@test.local");
  });

  it("refuses a second login for the same member", async () => {
    const { group, members } = await seedGroup();
    await inviteMemberLogin({
      groupId: group.id,
      memberId: members[0].id,
      email: "one@test.local",
      password: "member12345",
    });

    await expect(
      inviteMemberLogin({
        groupId: group.id,
        memberId: members[0].id,
        email: "again@test.local",
        password: "member12345",
      })
    ).rejects.toThrow(/already has a login/i);
  });

  it("refuses an email already in use", async () => {
    const { group, members, admin } = await seedGroup();

    await expect(
      inviteMemberLogin({
        groupId: group.id,
        memberId: members[0].id,
        email: admin.email,
        password: "member12345",
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects a bad email or a short password", async () => {
    const { group, members } = await seedGroup();
    const base = { groupId: group.id, memberId: members[0].id, password: "member12345" };

    await expect(inviteMemberLogin({ ...base, email: "nope" })).rejects.toThrow(/email/i);
    await expect(
      inviteMemberLogin({ ...base, email: "ok@test.local", password: "short" })
    ).rejects.toThrow(/8 characters/i);
  });

  it("refuses a member belonging to another group", async () => {
    const { members } = await seedGroup();
    const other = await seedGroup({ name: "Other", adminEmail: "m3@x.test" });

    await expect(
      inviteMemberLogin({
        groupId: other.group.id,
        memberId: members[0].id,
        email: "sneaky@test.local",
        password: "member12345",
      })
    ).rejects.toThrow(/could not be found/i);

    expect(await prisma.user.count({ where: { email: "sneaky@test.local" } })).toBe(0);
  });
});

describe("resetMemberPassword", () => {
  it("sets a new password without recording it in the audit log", async () => {
    const { group, members } = await seedGroup();
    await inviteMemberLogin({
      groupId: group.id,
      memberId: members[0].id,
      email: "reset@test.local",
      password: "oldpassword1",
    });

    await resetMemberPassword({
      groupId: group.id,
      memberId: members[0].id,
      password: "newpassword1",
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "reset@test.local" } });
    expect(await verifyPassword("newpassword1", user.passwordHash)).toBe(true);
    expect(await verifyPassword("oldpassword1", user.passwordHash)).toBe(false);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "RESET_MEMBER_PASSWORD" },
    });
    expect(JSON.stringify(audit.newValue)).not.toContain("newpassword1");
  });

  it("refuses a member with no login yet", async () => {
    const { group, members } = await seedGroup();

    await expect(
      resetMemberPassword({
        groupId: group.id,
        memberId: members[0].id,
        password: "newpassword1",
      })
    ).rejects.toThrow(/does not have a login/i);
  });
});
