import { commandText, proposedPatch, startupPacket } from "../core/commands.js";
import { pathCatalogText } from "../core/path-catalog.js";

export function healthReportText(report) {
  return JSON.stringify(report, null, 2);
}

export function startupPacketText(model) {
  return startupPacket(model);
}

export function commandsText(model) {
  return commandText(model);
}

export function proposedPatchText(model) {
  return JSON.stringify(proposedPatch(model), null, 2);
}

export function exportOptions(model, healthReport) {
  return [
    {
      id: "health",
      label: "health-report.json",
      defaultPath: "health-report.json",
      text: healthReportText(healthReport),
      filters: [{ name: "JSON", extensions: ["json"] }]
    },
    {
      id: "startup",
      label: "startup-packet.txt",
      defaultPath: "startup-packet.txt",
      text: startupPacketText(model),
      filters: [{ name: "Text", extensions: ["txt"] }]
    },
    {
      id: "commands",
      label: "commands.txt",
      defaultPath: "commands.txt",
      text: commandsText(model),
      filters: [{ name: "Text", extensions: ["txt"] }]
    },
    {
      id: "patch",
      label: "proposed-patch.json",
      defaultPath: "proposed-patch.json",
      text: proposedPatchText(model),
      filters: [{ name: "JSON", extensions: ["json"] }]
    },
    {
      id: "paths",
      label: "world-tree-paths.txt",
      defaultPath: "world-tree-paths.txt",
      text: pathCatalogText(),
      filters: [{ name: "Text", extensions: ["txt"] }]
    }
  ];
}
