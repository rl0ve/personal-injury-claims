/**
 * The Data Fabric row that wakes the Case Manager Agent.
 *
 * The case plan's global event is a CREATED listener on the
 * `InjuryClaimCaseEvent` entity, filtered `CaseId == metadata.InstanceId`.
 * Writing a row is therefore the whole mechanism by which a claims officer's
 * upload becomes something the case reacts to. The workspace app has always
 * done this (see caseService.writeCaseEvent); this is the same write for the
 * Action Center host.
 */
import type { UiPath } from '@uipath/uipath-typescript/core';
import { UiPathError } from '@uipath/uipath-typescript/core';
import { Entities } from '@uipath/uipath-typescript/entities';

/**
 * InjuryClaimCaseEvent. Hardcoded rather than read from an env var because
 * this app is only ever deployed against this tenant's entity, and an Action
 * Center iframe has no .env to read. Required field is CaseId; EventType,
 * Comment and DocumentName are optional.
 */
const EVIDENCE_ENTITY_ID = '2da1619c-b0b2-f111-a6a7-7c1e520b3a1e';

export async function writeCaseEvent(
  sdk: UiPath,
  isAuthenticated: boolean,
  caseInstanceId: string | undefined,
  fields: { eventType?: string; comment?: string; documentName?: string },
): Promise<{ written: boolean; reason?: string }> {
  if (!isAuthenticated) {
    return { written: false, reason: 'Not signed in to UiPath, so the case event could not be written.' };
  }
  if (!caseInstanceId) {
    // The case plan passes this as `=js:(metadata.InstanceId)`. If it is
    // missing the task predates that input, and a row written without it
    // matches no filter and wakes nothing — better to say so than to write
    // a row that silently goes nowhere.
    return { written: false, reason: 'No case instance id on this task, so the event has nothing to match against.' };
  }
  try {
    await new Entities(sdk).insertRecordById(EVIDENCE_ENTITY_ID, {
      CaseId: caseInstanceId,
      EventType: fields.eventType ?? 'DocumentUpload',
      Comment: fields.comment ?? '',
      DocumentName: fields.documentName ?? '',
    });
    return { written: true };
  } catch (err) {
    return {
      written: false,
      reason: err instanceof UiPathError ? err.message : String(err),
    };
  }
}
