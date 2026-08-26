import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import {
  getPropertySearchDraft,
  getProjectById,
  projectBelongsToOrg,
  upsertPropertySearchDraft,
  type PropertySearchDraftView,
} from "@/lib/repository";
import { getLatestReport } from "@/lib/repository-intelligence";
import { getDb } from "@/db/client";
import type { MarketReportSnapshot } from "@/lib/export/types";

function parseCommunity(community: string): { city: string; state: string } {
  const parts = community.split(",").map((part) => part.trim());
  return {
    city: parts[0] ?? "",
    state: parts[1] ?? "",
  };
}

export async function GET(request: Request) {
  const { organizationId, user } = await requireOrganization();
  const url = new URL(request.url);
  const projectId = (url.searchParams.get("project") ?? "").trim();
  const zipCode = (url.searchParams.get("zip") ?? "").trim();

  if (!projectId || !/^\d{5}$/.test(zipCode)) {
    return new NextResponse("Invalid property-search handoff.", { status: 400 });
  }

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) {
    return new NextResponse("Project not found.", { status: 404 });
  }

  const project = await getProjectById(projectId, organizationId);
  if (!project) {
    return new NextResponse("Project not found.", { status: 404 });
  }

  let city = "";
  let state = "";
  const db = getDb();

  if (db) {
    try {
      const reportRow = await getLatestReport(db, organizationId, projectId);
      if (reportRow?.reportJson) {
        const report = JSON.parse(reportRow.reportJson) as MarketReportSnapshot;
        city = report.geography?.city ?? "";
        state = report.geography?.stateAbbr ?? "";
      }
    } catch (error) {
      console.error("[housing-search handoff] report geography read failed:", error);
    }
  }

  if (!city || !state) {
    const fallback = parseCommunity(project.community);
    city ||= fallback.city;
    state ||= fallback.state;
  }

  const saved = await getPropertySearchDraft(
    organizationId,
    user.dbUserId,
    projectId
  );

  const draft: PropertySearchDraftView = saved
    ? {
        ...saved,
        city,
        state,
        zipCode,
        submitted: false,
        lastSearchAt: null,
        resultsSnapshot: null,
        resultsCount: 0,
        queryFingerprint: null,
        mapLatitude: null,
        mapLongitude: null,
        mapRadiusMi: null,
        mapMode: "list",
      }
    : {
        projectId,
        city,
        state,
        zipCode,
        propertyType: "",
        minBedrooms: "",
        minBathrooms: "",
        maxRent: "",
        maxDaysListed: "",
        listingStatus: "active",
        submitted: false,
        lastSearchAt: null,
        resultsSnapshot: null,
        resultsCount: 0,
        queryFingerprint: null,
        mapLatitude: null,
        mapLongitude: null,
        mapRadiusMi: null,
        mapMode: "list",
      };

  const persisted = await upsertPropertySearchDraft(
    organizationId,
    user.dbUserId,
    draft
  );

  if (!persisted) {
    console.error("[housing-search handoff] draft persistence failed", {
      projectId,
      zipCode,
    });
    return new NextResponse(
      "The selected ZIP could not be saved. Please return to the City Report and try again.",
      { status: 500 }
    );
  }

  const destination = new URL("/housing-search", url.origin);
  destination.searchParams.set("project", projectId);
  return NextResponse.redirect(destination);
}
