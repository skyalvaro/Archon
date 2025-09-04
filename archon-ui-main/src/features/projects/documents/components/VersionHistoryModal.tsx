import { AlertTriangle, Calendar, Clock, Diff, FileText, GitBranch, RotateCcw, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../../contexts/ToastContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../ui/primitives";
import { cn, glassmorphism } from "../../../ui/primitives/styles";
import { documentService } from "../services";

interface Version {
  id: string;
  version_number: number;
  change_summary: string;
  change_type: string;
  created_by: string;
  created_at: string;
  content: unknown; // Can be document content or other versioned data
  document_id?: string;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  documentId?: string;
  fieldName?: string;
  onRestore?: () => void;
}

export const VersionHistoryModal = ({
  isOpen,
  onClose,
  projectId,
  fieldName = "docs",
  onRestore,
}: VersionHistoryModalProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<Version | null>(null);

  const { showToast } = useToast();

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await documentService.getDocumentVersionHistory(projectId, fieldName);
      setVersions(response || []);
    } catch (error) {
      console.error("Failed to load versions:", error);
      showToast("Failed to load version history", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, fieldName, showToast]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadVersions();
    }
  }, [isOpen, projectId, loadVersions]);

  const handleRestore = (version: Version) => {
    setVersionToRestore(version);
    setShowRestoreConfirm(true);
  };

  const confirmRestore = async () => {
    if (!versionToRestore) return;

    setRestoring(true);
    try {
      await documentService.restoreDocumentVersion(projectId, versionToRestore.version_number, fieldName);

      showToast(`Version ${versionToRestore.version_number} restored successfully`, "success");
      setShowRestoreConfirm(false);
      setVersionToRestore(null);
      onRestore?.();
      onClose();
    } catch (error) {
      console.error("Failed to restore version:", error);
      showToast("Failed to restore version", "error");
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case "create":
        return <FileText className="w-4 h-4" />;
      case "update":
        return <Diff className="w-4 h-4" />;
      case "restore":
        return <RotateCcw className="w-4 h-4" />;
      default:
        return <GitBranch className="w-4 h-4" />;
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case "create":
        return "text-green-600 dark:text-green-400";
      case "update":
        return "text-blue-600 dark:text-blue-400";
      case "restore":
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Version History
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">No version history available</div>
          ) : (
            <div className="flex gap-4 flex-1 min-h-0">
              {/* Version List */}
              <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="p-4 space-y-2">
                  {versions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      onClick={() => setSelectedVersion(version)}
                      className={cn(
                        "w-full p-3 rounded-lg text-left transition-all",
                        selectedVersion?.id === version.id
                          ? cn(glassmorphism.background.cyan, "border-cyan-500")
                          : cn(glassmorphism.background.subtle, "hover:bg-gray-100 dark:hover:bg-gray-800"),
                        "border border-gray-200 dark:border-gray-700",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn("mt-1", getChangeTypeColor(version.change_type))}>
                          {getChangeTypeIcon(version.change_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 dark:text-white">
                            Version {version.version_number}
                          </div>
                          {version.change_summary && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {version.change_summary}
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {version.created_by}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(version.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Version Details */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedVersion && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        Version {selectedVersion.version_number} Details
                      </h3>
                      <div className="flex gap-2">
                        <Button onClick={() => handleRestore(selectedVersion)} variant="outline" size="sm">
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "p-4 rounded-lg",
                        glassmorphism.background.subtle,
                        "border border-gray-200 dark:border-gray-700",
                      )}
                    >
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Content Preview</h4>
                      <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                        {JSON.stringify(selectedVersion.content, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Restore Version
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore to version {versionToRestore?.version_number}? This will create a new
              version with the restored content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={restoring}>
              {restoring ? "Restoring..." : "Restore Version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
