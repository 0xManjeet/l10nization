import * as vscode from 'vscode';
import { EditFilesParameters } from '../commands/editFilesParameters';
import { Configuration } from '../shared/configuration';
import { getArbFiles } from './getArbFiles';
import { getFunctionCall } from './getFunctionCall';
import { getProjectName } from './getProjectName';
import { L10nObject } from './l10nObject';
import { toJson } from './toJson';

export async function getChangesForArbFiles(parameters: EditFilesParameters): Promise<vscode.WorkspaceEdit> {
  const projectName = getProjectName(parameters.uri);
  const [files, templateFile] = await getArbFiles(projectName);
  if (files.length === 0) {
    vscode.window.showErrorMessage(`No arb files found.`);
    throw new Error(`No arb files found.`);
  }
  if (!templateFile) {
    vscode.window.showErrorMessage(`No template arb file found.`);
    throw new Error(`No template arb file found.`);
  }
  
  const openTextDocuments: Thenable<vscode.TextDocument>[] = [];
  files.forEach((file) => {
    openTextDocuments.push(vscode.workspace.openTextDocument(file));
  });
  
  const { key, value } = parameters.keyValue;
  const { description, placeholders } = parameters;
  
  // Check if the key already exists in any of the ARB files
  const openDocs = await Promise.all(openTextDocuments);
  var hasDuplicateKey=false
  
  for (const doc of openDocs) {
    const jsonContent = JSON.parse(doc.getText());
    if (key in jsonContent && jsonContent[key] !== value) {
      hasDuplicateKey = true;
      break
    }
  }

  if (hasDuplicateKey ) {
    vscode.window.showErrorMessage(`The key "${key}" already exists with a different value.`);
    throw new Error(`The key "${key}" already exists with a different value.`);
  }
  
  const workspaceEdit = new vscode.WorkspaceEdit();
  const sortArbEnabled = Configuration.getInstance().getSortArbEnabled();
  openDocs.forEach((content, index) => {
    const file = files[index];
    const isMetadataEnabled = Configuration.getInstance().getCopyMetadataInAllFiles();
    workspaceEdit.replace(
      file,
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)),
      toJson(content.getText(), new L10nObject(isMetadataEnabled || file === templateFile, key, description, value, placeholders), sortArbEnabled),
    );
  });

  const appLocalizationsVariable = Configuration.getInstance().getAppLocalizationsVariable();
  workspaceEdit.replace(
    parameters.uri,
    parameters.range,
    getFunctionCall(
      appLocalizationsVariable,
      key,
      placeholders.map((p) => p.value),
    ),
  );
  
  return workspaceEdit;
}
