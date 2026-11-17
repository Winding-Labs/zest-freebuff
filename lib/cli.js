#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res, err) => () => {
  if (fn)
    try {
      res = fn(fn = 0);
    } catch (e) {
      err = [e];
    }
  if (err)
    throw err[0];
  return res;
};
// ../../packages/plugin-common/src/dev/parse-dev-argv.ts
var CLI_GROUPS;
var init_parse_dev_argv = __esm(() => {
  CLI_GROUPS = new Set(["command", "hook", "daemon"]);
});

// ../../packages/plugin-common/src/logger/handled.ts
function defaultHandledLogger(logger) {
  sink ??= logger;
}
function logHandled(reason, error) {
  if (error === undefined)
    sink?.debug(reason);
  else
    sink?.debug(reason, error);
}
var sink;

// ../../packages/plugin-common/src/shared/error.ts
function stringifySafely(value) {
  if (value === null || typeof value !== "object")
    return String(value);
  try {
    return JSON.stringify(value) ?? "[unstringifiable error]";
  } catch {
    return "[unstringifiable error]";
  }
}
function describe(value, depth) {
  if (typeof value === "string")
    return value;
  if (value === null || typeof value !== "object")
    return String(value);
  const record = value;
  const ownMessage = typeof record.message === "string" ? record.message : "";
  const isError = value instanceof Error;
  if (!isError && !ownMessage)
    return stringifySafely(value);
  const name = isError && typeof record.name === "string" ? record.name : "";
  const message = ownMessage || name || "Unknown error";
  const extra = [];
  if (ownMessage && name && name !== "Error")
    extra.push(name);
  if (typeof record.code === "string" || typeof record.code === "number") {
    extra.push(`code ${record.code}`);
  }
  let text = extra.length > 0 ? `${message} (${extra.join(", ")})` : message;
  if (record.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    text += ` (cause: ${describe(record.cause, depth + 1)})`;
  }
  return text;
}
function describeError(value) {
  try {
    return describe(value, 0) || "Unknown error";
  } catch {
    return "[unstringifiable error]";
  }
}
function withoutParsedInput(error) {
  return error instanceof SyntaxError ? error.name : error;
}
var MAX_CAUSE_DEPTH = 3;

// ../../packages/plugin-common/src/utils/processes.ts
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}
var init_processes = () => {};

// ../../packages/plugin-common/src/dev/process-liveness.ts
import { readFile, unlink } from "node:fs/promises";
function removePidFile(pidFile) {
  return unlink(pidFile).catch((error) => {
    logHandled("pid file not removed; it may already be gone", error);
  });
}
async function stopProcessFromPidFile(pidFile, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const isRunning = options.isRunning ?? isProcessAlive;
  const kill = options.kill ?? ((pid, signal) => {
    process.kill(pid, signal);
  });
  let pid;
  try {
    const raw = await readFile(pidFile, "utf-8");
    pid = Number.parseInt(raw.trim(), 10);
  } catch (error) {
    logHandled("pid file missing or unreadable; nothing to stop", error);
    return false;
  }
  if (!Number.isInteger(pid) || pid <= 0 || !isRunning(pid)) {
    await removePidFile(pidFile);
    return false;
  }
  try {
    kill(pid, "SIGTERM");
  } catch (error) {
    logHandled("SIGTERM failed; treating the process as already stopped", error);
    await removePidFile(pidFile);
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isRunning(pid)) {
      await removePidFile(pidFile);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  try {
    kill(pid, "SIGKILL");
  } catch (error) {
    logHandled("SIGKILL failed; the process already exited", error);
  }
  await removePidFile(pidFile);
  return true;
}
var init_process_liveness = __esm(() => {
  init_processes();
});
// ../../packages/plugin-common/src/dev/session-swap.ts
var init_session_swap = __esm(() => {
  init_processes();
  init_process_liveness();
});

// ../../packages/plugin-common/src/dev/start-dev-session.ts
var init_start_dev_session = __esm(() => {
  init_processes();
  init_session_swap();
});

// ../../packages/plugin-common/src/dev/run-dev-entry.ts
var init_run_dev_entry = __esm(() => {
  init_parse_dev_argv();
  init_session_swap();
  init_start_dev_session();
});

// ../../packages/plugin-common/src/dev/index.ts
var init_dev = __esm(() => {
  init_parse_dev_argv();
  init_process_liveness();
  init_run_dev_entry();
  init_session_swap();
  init_start_dev_session();
});

// ../../packages/plugin-common/src/collector/persistence.ts
import { open, rename, unlink as unlink2 } from "node:fs/promises";
import { dirname } from "node:path";
async function renameWithRetry(from, to) {
  for (let attempt = 0;; attempt++) {
    try {
      return await rename(from, to);
    } catch (error) {
      const code = error.code;
      if (attempt >= 10 || !["EPERM", "EBUSY", "EACCES"].includes(code ?? ""))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}
async function durableWrite(path, content) {
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 384);
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    if (process.platform === "win32") {
      await renameWithRetry(temporary, path);
      return;
    }
    await rename(temporary, path);
    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await unlink2(temporary).catch((error) => {
      if (error.code !== "ENOENT")
        logHandled("durable write: could not remove the temporary file", error);
    });
  }
}
async function writeJson(path, value) {
  await durableWrite(path, `${JSON.stringify(value, null, 2)}
`);
}
var init_persistence = () => {};

// ../../packages/plugin-common/src/analytics/events.ts
function getErrorCategory(errorType) {
  if (errorType.startsWith("auth_"))
    return "auth";
  if (errorType.startsWith("sync_"))
    return "sync";
  if (errorType.startsWith("queue_") || errorType.startsWith("file_") || errorType.startsWith("notification_") || errorType.startsWith("extraction_"))
    return "filesystem";
  if (errorType.startsWith("daemon_"))
    return "daemon";
  if (errorType.startsWith("api_"))
    return "api";
  return "api";
}
var SYNC_CHAT_UPLOAD_FAILED = "sync_chat_upload_failed", SYNC_STUCK = "sync_stuck", QUEUE_READ_CORRUPTED = "queue_read_corrupted", QUEUE_WRITE_FAILED = "queue_write_failed", FILE_LOCK_TIMEOUT = "file_lock_timeout", FILE_LOCK_CREATE_FAILED = "file_lock_create_failed", QUEUE_CAP_EVICTION = "queue_cap_eviction", QUEUE_MISMATCHED_ENTRIES_PURGED = "queue_mismatched_entries_purged", SYNC_DRAIN_THROTTLED = "sync_drain_throttled", SYNC_BATCH_PARKED = "sync_batch_parked", SYNC_EVENTS_REJECTED = "sync_events_rejected";
var init_events = () => {};

// ../../packages/plugin-common/src/analytics/properties.ts
import { release } from "node:os";
import { basename } from "node:path";
function buildStandardProperties(version) {
  return {
    plugin_version: version,
    node_version: process.version,
    os_platform: process.platform,
    os_version: release()
  };
}
function buildUserProperties(session) {
  if (!session)
    return {};
  return {
    user_id: session.userId,
    email: session.email,
    workspace_id: session.workspaceId,
    workspace_name: session.workspaceName
  };
}
function buildSyncProperties(options) {
  return {
    ...options.syncErrorType && { sync_error_type: options.syncErrorType },
    ...options.eventsAttempted !== undefined && { events_attempted: options.eventsAttempted },
    ...options.sessionsAttempted !== undefined && {
      sessions_attempted: options.sessionsAttempted
    },
    ...options.messagesAttempted !== undefined && {
      messages_attempted: options.messagesAttempted
    },
    ...options.retryAttempt !== undefined && { retry_attempt: options.retryAttempt }
  };
}
function buildFileSystemProperties(options) {
  const anonymizedPath = options.filePath ? basename(options.filePath) : undefined;
  return {
    ...anonymizedPath && { file_name: anonymizedPath },
    operation: options.operation,
    ...options.errnoCode && { errno_code: options.errnoCode }
  };
}
var init_properties = () => {};

// ../../packages/plugin-common/src/utils/fs-utils.ts
import { chmod, mkdir, stat } from "node:fs/promises";
async function ensureDirectory(dirPath) {
  try {
    await stat(dirPath);
  } catch {
    await mkdir(dirPath, { recursive: true, mode: 448 });
  }
}
async function secureDirectory(dirPath) {
  try {
    await chmod(dirPath, 448);
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
  }
}
var init_fs_utils = () => {};

// ../../packages/plugin-common/src/utils/file-lock.ts
import { unlinkSync } from "node:fs";
import { readdir, readFile as readFile2, unlink as unlink3, writeFile } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";
function isLockStale(lockInfo, isRunning) {
  return !isRunning(lockInfo.pid);
}
async function acquireFileLock(filePath, isRunning, options, activeLockFiles, depth = 0) {
  if (depth >= MAX_ACQUIRE_DEPTH) {
    options.logger?.warn(`Lock acquisition for ${filePath} exceeded max recursive depth (${MAX_ACQUIRE_DEPTH})`);
    return false;
  }
  const lockFile = `${filePath}.lock`;
  const lockInfo = {
    pid: process.pid,
    timestamp: Date.now()
  };
  try {
    await ensureDirectory(dirname2(lockFile));
    await writeFile(lockFile, JSON.stringify(lockInfo), { flag: "wx" });
    activeLockFiles?.add(lockFile);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") {
      const errCode = error.code;
      if (errCode === "ENOENT" || errCode === "EACCES") {
        options.logger?.error(`Failed to create lock file ${lockFile}:`, error);
        options.onCaptureException?.(error, FILE_LOCK_CREATE_FAILED, "file-lock", {
          ...buildFileSystemProperties({
            filePath: lockFile,
            operation: "lock",
            errnoCode: errCode
          })
        });
      }
      throw error;
    }
    try {
      const content = await readFile2(lockFile, "utf8");
      const existingLock = JSON.parse(content);
      if (isLockStale(existingLock, isRunning)) {
        options.logger?.debug(`Removing stale lock for ${filePath} (PID ${existingLock.pid} is dead)`);
        await unlink3(lockFile).catch((error) => {
          options.logger?.debug(`Could not remove stale lock for ${filePath}`, error);
        });
        return acquireFileLock(filePath, isRunning, options, activeLockFiles, depth + 1);
      }
    } catch (error) {
      options.logger?.debug(`Lock file for ${filePath} is corrupted or unreadable, removing`, error);
      await unlink3(lockFile).catch((unlinkError) => {
        options.logger?.debug(`Could not remove corrupted lock for ${filePath}`, unlinkError);
      });
      return acquireFileLock(filePath, isRunning, options, activeLockFiles, depth + 1);
    }
    return false;
  }
}
async function releaseFileLock(filePath, activeLockFiles, logger) {
  const lockFile = `${filePath}.lock`;
  activeLockFiles?.delete(lockFile);
  await unlink3(lockFile).catch((error) => {
    logger?.debug(`Could not remove lock file for ${filePath}`, error);
  });
}
function createFileLock(config) {
  const {
    logger,
    onCaptureException,
    lockRetryMs = DEFAULT_LOCK_RETRY_MS,
    lockMaxRetries = DEFAULT_LOCK_MAX_RETRIES,
    lockDir
  } = config;
  const isRunning = config.isProcessRunning ?? isProcessAlive;
  const options = {
    logger,
    onCaptureException,
    isProcessRunning: isRunning,
    lockRetryMs,
    lockMaxRetries
  };
  const activeLockFiles = new Set;
  async function withFileLockInstance(filePath, fn) {
    let retries = 0;
    while (!await acquireFileLock(filePath, isRunning, options, activeLockFiles)) {
      if (++retries >= lockMaxRetries) {
        const error = new Error(`Failed to acquire lock for ${filePath} after ${retries} retries`);
        onCaptureException?.(error, FILE_LOCK_TIMEOUT, "file-lock", {
          ...buildFileSystemProperties({ filePath, operation: "lock" }),
          retries,
          max_retries: lockMaxRetries,
          retry_delay_ms: lockRetryMs
        });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, lockRetryMs));
    }
    try {
      return await fn();
    } finally {
      await releaseFileLock(filePath, activeLockFiles, logger);
    }
  }
  function cleanupLockFiles() {
    for (const lockFile of activeLockFiles) {
      try {
        unlinkSync(lockFile);
      } catch (error) {
        logger?.debug(`Could not remove lock file ${lockFile} at exit`, error);
      }
    }
    activeLockFiles.clear();
  }
  async function cleanupStaleLocks() {
    if (!lockDir) {
      logger?.debug("No lockDir configured, skipping stale lock cleanup");
      return;
    }
    try {
      const files = await readdir(lockDir).catch((error) => {
        logger?.debug("Lock directory missing or unreadable; no stale locks", error);
        return [];
      });
      const lockFiles = files.filter((f) => f.endsWith(".lock"));
      for (const lockFileName of lockFiles) {
        const lockFile = `${lockDir}/${lockFileName}`;
        try {
          const content = await readFile2(lockFile, "utf8");
          const lockInfo = JSON.parse(content);
          if (!isRunning(lockInfo.pid)) {
            await unlink3(lockFile);
            logger?.info(`Cleaned up stale lock file: ${lockFileName} (PID ${lockInfo.pid} is dead)`);
          }
        } catch (error) {
          logger?.debug(`Lock file ${lockFileName} is corrupted or unreadable`, error);
          await unlink3(lockFile).catch((unlinkError) => {
            logger?.debug(`Could not remove corrupted lock file ${lockFileName}`, unlinkError);
          });
          logger?.info(`Removed corrupted lock file: ${lockFileName}`);
        }
      }
    } catch (error) {
      logger?.debug("Failed to clean up stale locks:", error);
    }
  }
  let cleanupRegistered = false;
  function setupLockCleanup() {
    if (cleanupRegistered)
      return;
    cleanupRegistered = true;
    process.on("exit", cleanupLockFiles);
    process.on("SIGINT", () => {
      cleanupLockFiles();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanupLockFiles();
      process.exit(0);
    });
    logger?.debug("Lock cleanup handlers registered");
  }
  return {
    withFileLock: withFileLockInstance,
    cleanupStaleLocks,
    cleanupLockFiles,
    setupLockCleanup
  };
}
function resolveFileLock(callback) {
  return callback ?? noopFileLock;
}
var DEFAULT_LOCK_RETRY_MS = 50, DEFAULT_LOCK_MAX_RETRIES = 300, MAX_ACQUIRE_DEPTH = 3, noopFileLock = (_path, fn) => fn();
var init_file_lock = __esm(() => {
  init_events();
  init_properties();
  init_fs_utils();
  init_processes();
});

// ../../packages/plugin-common/src/cache/status-cache-manager.ts
import { readFileSync } from "node:fs";
function createStatusCacheManager(config) {
  const {
    statusCacheFile,
    logger,
    notificationDurationMs = 0,
    standupNotificationThrottleMs = 0
  } = config;
  const withFileLock = resolveFileLock(config.withFileLock);
  function readStatusCache() {
    try {
      const data = readFileSync(statusCacheFile, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.updateAvailable !== undefined && !parsed.versionCheck) {
        logger?.info("Migrating old update-check.json format to new status-cache.json format");
        const migrated = {
          versionCheck: {
            updateAvailable: parsed.updateAvailable ?? false,
            currentVersion: parsed.currentVersion ?? "unknown",
            latestVersion: parsed.latestVersion ?? "unknown",
            checkedAt: parsed.checkedAt ?? 0
          },
          syncStatus: DEFAULT_SYNC_STATUS,
          devMode: DEFAULT_DEV_MODE_STATUS,
          standupNotification: DEFAULT_STANDUP_NOTIFICATION,
          daemonWarmingUpUntil: null
        };
        return migrated;
      }
      return {
        versionCheck: {
          ...DEFAULT_VERSION_CHECK,
          ...parsed.versionCheck
        },
        syncStatus: {
          ...DEFAULT_SYNC_STATUS,
          ...parsed.syncStatus
        },
        devMode: {
          ...DEFAULT_DEV_MODE_STATUS,
          ...parsed.devMode
        },
        standupNotification: {
          ...DEFAULT_STANDUP_NOTIFICATION,
          ...parsed.standupNotification
        },
        daemonWarmingUpUntil: parsed.daemonWarmingUpUntil ?? null,
        lastUpdate: parsed.lastUpdate ?? undefined,
        legacyQueueDrop: parsed.legacyQueueDrop ?? null,
        captureBlockedByAuth: parsed.captureBlockedByAuth ?? null
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        logger?.debug("Status cache file does not exist, using defaults");
      } else {
        logger?.warn("Failed to read status cache file, using defaults", error);
      }
      return DEFAULT_STATUS_CACHE;
    }
  }
  async function updateCache(what, change) {
    try {
      await withFileLock(statusCacheFile, async () => {
        const updated = change(readStatusCache());
        if (!updated)
          return;
        await writeJson(statusCacheFile, updated);
        logger?.debug(`Wrote ${what} to status cache`);
      });
    } catch (error) {
      logger?.error(`Failed to write ${what} to status cache`, error);
    }
  }
  function writeVersionCheck(check) {
    return updateCache("version check", (cache) => ({ ...cache, versionCheck: check }));
  }
  function writeLastUpdate(update) {
    return updateCache("last update", (cache) => ({
      ...cache,
      lastUpdate: update,
      versionCheck: { ...cache.versionCheck, updateAvailable: false }
    }));
  }
  function writeSyncStatus(status) {
    return updateCache("sync status", (cache) => ({
      ...cache,
      syncStatus: {
        ...status,
        lastSuccessAt: status.lastSuccessAt ?? cache.syncStatus.lastSuccessAt,
        stuckAlertedAt: status.stuckAlertedAt ?? cache.syncStatus.stuckAlertedAt ?? null
      }
    }));
  }
  function clearSyncError() {
    return updateCache("cleared sync error", (cache) => ({
      ...cache,
      syncStatus: {
        hasError: false,
        errorType: null,
        errorMessage: null,
        lastErrorAt: cache.syncStatus.lastErrorAt,
        lastSuccessAt: Date.now(),
        stuckAlertedAt: null
      }
    }));
  }
  function markStuckAlerted(now) {
    return updateCache("sync stuck alert", (cache) => ({
      ...cache,
      syncStatus: { ...cache.syncStatus, stuckAlertedAt: now }
    }));
  }
  function writeLegacyQueueDrop(counts) {
    return updateCache("legacy queue drop", (cache) => ({
      ...cache,
      legacyQueueDrop: {
        sessions: counts.sessions,
        messages: counts.messages,
        droppedAt: Date.now(),
        acknowledged: false
      }
    }));
  }
  function acknowledgeLegacyQueueDrop() {
    return updateCache("legacy queue drop acknowledgement", (cache) => !cache.legacyQueueDrop || cache.legacyQueueDrop.acknowledged ? null : { ...cache, legacyQueueDrop: { ...cache.legacyQueueDrop, acknowledged: true } });
  }
  function recordCaptureBlockedByAuth(sessionId) {
    return updateCache("capture blocked by auth", (cache) => {
      const existing = cache.captureBlockedByAuth;
      if (existing?.sessionIds.includes(sessionId))
        return null;
      return {
        ...cache,
        captureBlockedByAuth: {
          sessionIds: [...existing?.sessionIds ?? [], sessionId],
          since: existing?.since ?? Date.now()
        }
      };
    });
  }
  function clearCaptureBlockedByAuth(sessionId) {
    return updateCache("capture unblocked", (cache) => {
      const existing = cache.captureBlockedByAuth;
      if (!existing)
        return null;
      const remaining = existing.sessionIds.filter((id) => id !== sessionId);
      return {
        ...cache,
        captureBlockedByAuth: remaining.length > 0 ? { ...existing, sessionIds: remaining } : null
      };
    });
  }
  function writeDevModeActive() {
    return updateCache("dev mode", (cache) => ({ ...cache, devMode: { active: true } }));
  }
  function writeStandupNotification(message, options) {
    return updateCache("standup notification", (cache) => {
      const now = Date.now();
      return {
        ...cache,
        standupNotification: {
          ...cache.standupNotification,
          message,
          createdAt: now,
          expiresAt: now + notificationDurationMs,
          ...options?.updateFirstDataReadyThrottle && { firstDataReadyLastShownAt: now },
          ...options?.updateRefreshedThrottle && { standupRefreshedLastShownAt: now }
        }
      };
    });
  }
  function writeDaemonWarmingUp(durationMs) {
    return updateCache("daemon warmup grace period", (cache) => ({
      ...cache,
      daemonWarmingUpUntil: Date.now() + durationMs
    }));
  }
  function shouldShowStandupRefreshed() {
    try {
      const cache = readStatusCache();
      const { standupRefreshedLastShownAt } = cache.standupNotification;
      if (!standupRefreshedLastShownAt)
        return true;
      return Date.now() - standupRefreshedLastShownAt >= standupNotificationThrottleMs;
    } catch (error) {
      logger?.warn("Failed to check standup refreshed throttle", error);
      return true;
    }
  }
  function getLastSeenStandupCreatedAt() {
    try {
      return readStatusCache().standupNotification.lastSeenStandupCreatedAt;
    } catch (error) {
      logger?.warn("Failed to read last seen standup watermark", error);
      return null;
    }
  }
  function setLastSeenStandupCreatedAt(createdAt) {
    return updateCache("standup poll watermark", (cache) => ({
      ...cache,
      standupNotification: { ...cache.standupNotification, lastSeenStandupCreatedAt: createdAt }
    }));
  }
  return {
    readStatusCache,
    writeVersionCheck,
    writeLastUpdate,
    writeSyncStatus,
    clearSyncError,
    markStuckAlerted,
    writeLegacyQueueDrop,
    acknowledgeLegacyQueueDrop,
    recordCaptureBlockedByAuth,
    clearCaptureBlockedByAuth,
    writeDevModeActive,
    writeStandupNotification,
    writeDaemonWarmingUp,
    shouldShowStandupRefreshed,
    getLastSeenStandupCreatedAt,
    setLastSeenStandupCreatedAt
  };
}
var DEFAULT_VERSION_CHECK, DEFAULT_SYNC_STATUS, DEFAULT_DEV_MODE_STATUS, DEFAULT_STANDUP_NOTIFICATION, DEFAULT_STATUS_CACHE;
var init_status_cache_manager = __esm(() => {
  init_persistence();
  init_file_lock();
  DEFAULT_VERSION_CHECK = {
    updateAvailable: false,
    currentVersion: "unknown",
    latestVersion: "unknown",
    checkedAt: 0
  };
  DEFAULT_SYNC_STATUS = {
    hasError: false,
    errorType: null,
    errorMessage: null,
    lastErrorAt: null,
    lastSuccessAt: null,
    stuckAlertedAt: null
  };
  DEFAULT_DEV_MODE_STATUS = {
    active: false
  };
  DEFAULT_STANDUP_NOTIFICATION = {
    message: null,
    createdAt: null,
    expiresAt: null,
    firstDataReadyLastShownAt: null,
    standupRefreshedLastShownAt: null,
    lastSeenStandupCreatedAt: null
  };
  DEFAULT_STATUS_CACHE = {
    versionCheck: DEFAULT_VERSION_CHECK,
    syncStatus: DEFAULT_SYNC_STATUS,
    devMode: DEFAULT_DEV_MODE_STATUS,
    standupNotification: DEFAULT_STANDUP_NOTIFICATION,
    daemonWarmingUpUntil: null,
    legacyQueueDrop: null,
    captureBlockedByAuth: null
  };
});

// ../../packages/plugin-common/src/api/base.ts
function isAllowedApiBase(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === "https:")
      return true;
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  } catch (error) {
    logHandled("API base override is not a URL; not allowed", error);
    return false;
  }
}
function isTrustedApiBase(raw) {
  try {
    const url = new URL(raw);
    if (LOCAL_HOSTS.has(url.hostname))
      return url.protocol === "http:" || url.protocol === "https:";
    return OFFICIAL_API_BASES.includes(url.origin);
  } catch (error) {
    logHandled("API base is not a URL; not trusted for the legacy token", error);
    return false;
  }
}
function isOnApiHost(raw, apiBase) {
  try {
    const target = new URL(raw);
    const base = new URL(apiBase);
    if (target.origin === base.origin)
      return isAllowedApiBase(target.origin);
    return OFFICIAL_API_BASES.includes(target.origin) && OFFICIAL_API_BASES.includes(base.origin);
  } catch (error) {
    logHandled("URL or API base is not a URL; not on the API host", error);
    return false;
  }
}
function resolveApiBase() {
  const candidates = [process.env.ZEST_API_URL, ""];
  for (const candidate of candidates) {
    if (candidate && isAllowedApiBase(candidate))
      return candidate.replace(/\/+$/, "");
  }
  return API_BASE;
}
var API_BASE = "https://meetzest.com", OFFICIAL_API_BASES, LOCAL_HOSTS;
var init_base = __esm(() => {
  OFFICIAL_API_BASES = [API_BASE, "https://new.meetzest.com"];
  LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
});

// ../../packages/plugin-common/src/api/client.ts
import { arch, platform } from "node:os";
import { gzipSync } from "node:zlib";
function parseRetryAfter(value) {
  if (!value)
    return;
  const seconds = Number(value);
  if (Number.isFinite(seconds))
    return Math.max(0, seconds);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}
function createApiClient(config) {
  const doFetch = config.fetch ?? fetch;
  const apiBase = config.apiBase ?? resolveApiBase;
  const clientHeader = () => `${config.clientId}/${config.version()} (${platform()}-${arch()})`;
  async function request(path, options = {}) {
    const headers = {
      accept: "application/json",
      "x-zest-client": clientHeader(),
      ...options.headers
    };
    const credential = options.credential;
    if (credential && "token" in credential)
      headers.authorization = `Bearer ${credential.token}`;
    if (credential && "apiKey" in credential)
      headers["x-api-key"] = credential.apiKey;
    let body;
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      const json = JSON.stringify(options.body);
      if (options.gzip) {
        headers["content-encoding"] = "gzip";
        body = new Uint8Array(gzipSync(json));
      } else {
        body = json;
      }
    }
    const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response;
    try {
      response = await doFetch(`${apiBase()}${path}`, {
        method: options.method ?? (body === undefined ? "GET" : "POST"),
        headers,
        body,
        signal,
        redirect: "error"
      });
    } catch (error) {
      options.signal?.throwIfAborted();
      throw new ApiError(0, "network_error", `Could not reach Zest: ${describeError(error)}`);
    }
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const text = await response.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (!response.ok) {
      const errorBody = parsed;
      const nested = errorBody?.error;
      const code = typeof nested === "string" ? nested : nested?.code ?? (response.status >= 500 ? "server_error" : `http_${response.status}`);
      const message = typeof nested === "object" && nested?.message ? nested.message : `Zest returned ${response.status}`;
      throw new ApiError(response.status, code, message, requestId ?? errorBody?.request_id, parseRetryAfter(response.headers.get("retry-after")));
    }
    return { status: response.status, data: parsed };
  }
  return { clientId: config.clientId, apiBase, clientHeader, request };
}
var ApiError, DEFAULT_TIMEOUT_MS = 30000;
var init_client = __esm(() => {
  init_base();
  ApiError = class ApiError extends Error {
    status;
    code;
    requestId;
    retryAfterS;
    constructor(status, code, message, requestId, retryAfterS) {
      super(message);
      this.status = status;
      this.code = code;
      this.requestId = requestId;
      this.retryAfterS = retryAfterS;
      this.name = "ApiError";
    }
    get isNetwork() {
      return this.status === 0;
    }
  };
});

// ../../packages/plugin-common/src/shared/to-well-formed.ts
function toWellFormed(str) {
  return str.toWellFormed?.() ?? str;
}

// ../../packages/plugin-common/src/queue/queue-manager.ts
import { randomUUID } from "node:crypto";
import { appendFile, readFile as readFile3, unlink as unlink4, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname3 } from "node:path";
function redactStrings(value, privacy) {
  if (typeof value === "string")
    return privacy.redactMessage(value);
  if (Array.isArray(value))
    return value.map((item) => redactStrings(item, privacy));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactStrings(item, privacy)]));
  }
  return value;
}
function createQueueManager(config) {
  const {
    queueDir,
    queueFiles,
    minMessagesPerSession: minMessages = 3,
    logger,
    privacyManager,
    onCaptureException
  } = config;
  const maxQueueSizeMap = config.maxQueueSize;
  const minMessagesPerSession = () => typeof minMessages === "function" ? minMessages() : minMessages;
  async function persistQueue(path, content) {
    if (config.durable)
      await durableWrite(path, content);
    else
      await writeFile2(path, content, { encoding: "utf8", mode: QUEUE_FILE_MODE });
  }
  const withFileLock = resolveFileLock(config.withFileLock);
  async function readJsonl(filePath) {
    try {
      const content = await readFile3(filePath, "utf8");
      const lines = content.trim().split(`
`).filter(Boolean);
      const results = [];
      let corruptedLines = 0;
      for (let i = 0;i < lines.length; i++) {
        try {
          results.push(JSON.parse(lines[i]));
        } catch (error) {
          logger?.warn(`Failed to parse line ${i + 1} in ${filePath}:`, error);
          corruptedLines++;
          if (config.durable)
            throw new Error("Queue contains an incomplete or corrupt record");
        }
      }
      if (corruptedLines > 0) {
        onCaptureException?.(new Error(`Queue file has ${corruptedLines} corrupted lines`), QUEUE_READ_CORRUPTED, "queue-manager", {
          ...buildFileSystemProperties({ filePath, operation: "read" }),
          corrupted_lines: corruptedLines,
          total_lines: lines.length
        });
      }
      return results;
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
  async function countLines(filePath) {
    try {
      const content = await readFile3(filePath, "utf8");
      const lines = content.trim().split(`
`).filter(Boolean);
      return lines.length;
    } catch (error) {
      if (error.code === "ENOENT") {
        return 0;
      }
      throw error;
    }
  }
  async function deleteFile(filePath) {
    try {
      await unlink4(filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
  function sanitizingReplacer(_key, value) {
    if (typeof value === "string") {
      return toWellFormed(value);
    }
    return value;
  }
  function redactJson(value) {
    return privacyManager ? redactStrings(value, privacyManager) : value;
  }
  function assertPrivacyReady(caller) {
    if (privacyManager && !privacyManager.isInitialized()) {
      throw new Error(`${caller}: privacyManager is configured but not initialized — call ` + "privacyManager.initialize() before any capture path reaches the queue.");
    }
  }
  async function enqueueChatSession(session) {
    assertPrivacyReady("enqueueChatSession");
    try {
      const redactedSession = {
        ...session,
        title: redactJson(session.title),
        project_name: redactJson(session.project_name),
        metadata: redactJson(session.metadata),
        signals: redactJson(session.signals),
        event_id: session.event_id ?? randomUUID()
      };
      await appendItem(queueFiles.sessions, redactedSession, (existing, newItem) => existing.some((sess) => sess.id === newItem.id));
      logger?.debug("Enqueued session", { sessionId: redactedSession.id });
    } catch (error) {
      logger?.error("Failed to enqueue session:", error);
      throw error;
    }
  }
  async function enqueueChatMessage(message) {
    assertPrivacyReady("enqueueChatMessage");
    try {
      const redactedMessage = {
        ...message,
        content: redactJson(message.content),
        metadata: redactJson(message.metadata),
        event_id: message.event_id ?? randomUUID()
      };
      await appendItem(queueFiles.messages, redactedMessage, (existing, newItem) => existing.some((msg) => msg.id === newItem.id));
      logger?.debug("Enqueued message", {
        sessionId: redactedMessage.session_id,
        messageIndex: redactedMessage.message_index
      });
    } catch (error) {
      logger?.error("Failed to enqueue message:", error);
      throw error;
    }
  }
  async function patchQueuedSession(sessionId, metadata, rawTitle) {
    if (rawTitle)
      assertPrivacyReady("patchQueuedSession");
    const title = redactJson(rawTitle);
    let found = false;
    await atomicUpdateQueue(queueFiles.sessions, (sessions) => sessions.map((session) => {
      if (session.id !== sessionId)
        return session;
      found = true;
      return {
        ...session,
        title: title ?? session.title,
        metadata: {
          ...session.metadata ?? {},
          ...redactJson(metadata)
        },
        event_id: randomUUID()
      };
    }));
    return found;
  }
  async function patchSession(identity, sessionId, patch) {
    if (patch.title || patch.signals !== undefined)
      assertPrivacyReady("patchSession");
    const title = redactJson(patch.title);
    const signals = redactJson(patch.signals);
    let found = false;
    await atomicUpdateQueue(queueFiles.sessions, (sessions) => {
      const next = sessions.map((session) => {
        if (session.id !== sessionId)
          return session;
        found = true;
        return {
          ...session,
          title: title ?? session.title,
          metadata: {
            ...session.metadata ?? {},
            ...redactJson(patch.metadata) ?? {}
          },
          ...signals !== undefined ? { signals } : {},
          event_id: randomUUID()
        };
      });
      if (found)
        return next;
      return [
        ...next,
        {
          id: sessionId,
          user_id: identity.user_id,
          workspace_id: identity.workspace_id,
          patch: true,
          event_id: randomUUID(),
          ...title ? { title } : {},
          ...patch.metadata ? { metadata: redactJson(patch.metadata) } : {},
          ...signals !== undefined ? { signals } : {}
        }
      ];
    });
  }
  async function readQueue(queueFile) {
    try {
      return await readJsonl(queueFile);
    } catch (error) {
      logger?.error(`Failed to read queue file ${queueFile}:`, error);
      throw error;
    }
  }
  async function writeQueue(queueFile, items) {
    try {
      await withFileLock(queueFile, async () => {
        await ensureDirectory(dirname3(queueFile));
        const content = items.map((item) => JSON.stringify(item, sanitizingReplacer)).join(`
`) + (items.length > 0 ? `
` : "");
        await persistQueue(queueFile, content);
        logger?.debug(`Wrote ${items.length} items to queue file: ${queueFile}`);
      });
    } catch (error) {
      logger?.error(`Failed to write queue file ${queueFile}:`, error);
      if (error instanceof Error) {
        onCaptureException?.(error, QUEUE_WRITE_FAILED, "queue-manager", {
          ...buildFileSystemProperties({
            filePath: queueFile,
            operation: "write",
            errnoCode: error.code
          }),
          items_count: items.length
        });
      }
      throw error;
    }
  }
  async function atomicUpdateQueue(queueFile, transform) {
    try {
      await withFileLock(queueFile, async () => {
        const currentItems = await readJsonl(queueFile);
        const newItems = transform(currentItems);
        await ensureDirectory(dirname3(queueFile));
        const content = newItems.map((item) => JSON.stringify(item, sanitizingReplacer)).join(`
`) + (newItems.length > 0 ? `
` : "");
        await persistQueue(queueFile, content);
        logger?.debug(`Atomically updated queue file: ${queueFile} (${currentItems.length} → ${newItems.length} items)`);
      });
    } catch (error) {
      logger?.error(`Failed to atomically update queue file ${queueFile}:`, error);
      throw error;
    }
  }
  async function clearQueue(queueFile) {
    try {
      await withFileLock(queueFile, async () => {
        await deleteFile(queueFile);
        logger?.debug(`Cleared queue file: ${queueFile}`);
      });
    } catch (error) {
      logger?.error(`Failed to clear queue file ${queueFile}:`, error);
      throw error;
    }
  }
  async function getQueueStats() {
    try {
      await ensureDirectory(queueDir);
      const [sessions, messages] = await Promise.all([
        countLines(queueFiles.sessions),
        countLines(queueFiles.messages)
      ]);
      return { sessions, messages };
    } catch (error) {
      logger?.error("Failed to get queue stats:", error);
      return { sessions: 0, messages: 0 };
    }
  }
  async function initializeQueue() {
    try {
      await ensureDirectory(queueDir);
      logger?.debug("Queue directory initialized");
    } catch (error) {
      logger?.error("Failed to initialize queue directory:", error);
      throw error;
    }
  }
  async function appendItem(queueFile, item, isDuplicate) {
    await withFileLock(queueFile, async () => {
      let existingItems;
      if (isDuplicate) {
        existingItems = await readJsonl(queueFile);
        if (isDuplicate(existingItems, item)) {
          logger?.debug(`Skipping duplicate item in ${queueFile}`);
          return;
        }
      }
      const cap = maxQueueSizeMap?.get(queueFile);
      if (cap && cap > 0) {
        const currentItems = existingItems ?? await readJsonl(queueFile);
        if (currentItems.length >= cap) {
          const targetSize = Math.floor(cap * 0.9);
          const itemsToEvict = currentItems.length - targetSize;
          const trimmed = currentItems.slice(itemsToEvict);
          await ensureDirectory(dirname3(queueFile));
          const content = [...trimmed, item].map((i) => JSON.stringify(i, sanitizingReplacer)).join(`
`) + `
`;
          await persistQueue(queueFile, content);
          logger?.warn(`Queue cap reached for ${queueFile}: evicted ${itemsToEvict} oldest items (${currentItems.length} → ${trimmed.length + 1})`);
          onCaptureException?.(new Error(`Queue cap reached: evicted ${itemsToEvict} oldest items`), QUEUE_CAP_EVICTION, "queue-manager", {
            evicted_count: itemsToEvict,
            queue_size_before: currentItems.length,
            queue_size_after: trimmed.length + 1,
            cap,
            filePath: queueFile
          });
          return;
        }
      }
      await ensureDirectory(dirname3(queueFile));
      const line = JSON.stringify(item, sanitizingReplacer) + `
`;
      if (config.durable) {
        let previous = "";
        try {
          previous = await readFile3(queueFile, "utf8");
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
        }
        await persistQueue(queueFile, previous + line);
      } else {
        await appendFile(queueFile, line, { encoding: "utf8", mode: QUEUE_FILE_MODE });
      }
    });
  }
  async function getDetailedQueueStats() {
    try {
      await ensureDirectory(queueDir);
      const [sessions, messages] = await Promise.all([
        readJsonl(queueFiles.sessions),
        readJsonl(queueFiles.messages)
      ]);
      const maxMessageIndexBySession = new Map;
      for (const message of messages) {
        if (!message.session_id || message.message_index === undefined)
          continue;
        const currentMax = maxMessageIndexBySession.get(message.session_id) ?? -1;
        if (message.message_index > currentMax) {
          maxMessageIndexBySession.set(message.session_id, message.message_index);
        }
      }
      let readyToSync = 0;
      let waitingForMessages = 0;
      const readySessionIds = new Set;
      for (const session of sessions) {
        if (!session.id)
          continue;
        const maxIndex = maxMessageIndexBySession.get(session.id) ?? -1;
        if (session.patch || maxIndex >= minMessagesPerSession() - 1) {
          readyToSync++;
          readySessionIds.add(session.id);
        } else {
          waitingForMessages++;
        }
      }
      let messagesInReadySessions = 0;
      let messagesInWaitingSessions = 0;
      for (const message of messages) {
        if (!message.session_id)
          continue;
        if (readySessionIds.has(message.session_id)) {
          messagesInReadySessions++;
        } else {
          messagesInWaitingSessions++;
        }
      }
      return {
        sessions: {
          total: sessions.length,
          readyToSync,
          waitingForMessages
        },
        messages: {
          total: messages.length,
          inReadySessions: messagesInReadySessions,
          inWaitingSessions: messagesInWaitingSessions
        }
      };
    } catch (error) {
      logger?.error("Failed to get detailed queue stats:", error);
      return {
        sessions: { total: 0, readyToSync: 0, waitingForMessages: 0 },
        messages: { total: 0, inReadySessions: 0, inWaitingSessions: 0 }
      };
    }
  }
  return {
    readQueue,
    writeQueue,
    atomicUpdateQueue,
    clearQueue,
    countLines,
    getQueueStats,
    initializeQueue,
    appendItem,
    enqueueChatSession,
    enqueueChatMessage,
    patchQueuedSession,
    patchSession,
    getDetailedQueueStats
  };
}
var QUEUE_FILE_MODE = 384;
var init_queue_manager = __esm(() => {
  init_events();
  init_properties();
  init_persistence();
  init_file_lock();
  init_fs_utils();
});

// ../../packages/plugin-common/src/sync/error-classifier.ts
function isDataError(message) {
  const lower = message.toLowerCase();
  return DATA_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}
function isRetryableCategory(category) {
  return RETRYABLE_CATEGORIES.has(category);
}
function classifyApiError(error) {
  if (!(error instanceof ApiError))
    return classifyException(error);
  if (error.isNetwork)
    return "network_error";
  if (error.status === 429)
    return "rate_limited";
  if (error.status >= 500)
    return "server_overload";
  if (error.status === 401 || error.status === 403)
    return "auth_error";
  if (error.status === 400 || error.status === 413 || error.status === 415)
    return "data_error";
  return "unknown";
}
function errorDetailOf(error) {
  if (!(error instanceof ApiError))
    return;
  return { httpStatus: error.status, code: error.code, requestId: error.requestId };
}
function classifyException(error) {
  if (error instanceof ApiError)
    return classifyApiError(error);
  const message = error instanceof Error ? error.message : String(error);
  const messageLower = message.toLowerCase();
  const errnoCode = error?.code ?? "";
  if (NETWORK_ERRNO_CODES.has(errnoCode))
    return "network_error";
  if (error instanceof TypeError && messageLower.includes("fetch"))
    return "network_error";
  if (messageLower.includes("network") || messageLower.includes("econnrefused") || messageLower.includes("etimedout") || messageLower.includes("timeout") || messageLower.includes("fetch")) {
    return "network_error";
  }
  if (isDataError(message))
    return "data_error";
  return "unknown";
}
var DATA_ERROR_PATTERNS, NETWORK_ERRNO_CODES, RETRYABLE_CATEGORIES;
var init_error_classifier = __esm(() => {
  init_client();
  DATA_ERROR_PATTERNS = [
    "unsupported unicode escape sequence",
    "invalid byte sequence",
    "invalid input syntax for type json",
    "value too long for type character varying"
  ];
  NETWORK_ERRNO_CODES = new Set([
    "ENOTFOUND",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENETUNREACH"
  ]);
  RETRYABLE_CATEGORIES = new Set([
    "unknown",
    "network_error",
    "server_overload",
    "rate_limited"
  ]);
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/sha1.js
import { createHash } from "node:crypto";
function sha1(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === "string") {
    bytes = Buffer.from(bytes, "utf8");
  }
  return createHash("sha1").update(bytes).digest();
}
var sha1_default;
var init_sha1 = __esm(() => {
  sha1_default = sha1;
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/regex.js
var regex_default;
var init_regex = __esm(() => {
  regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default;
var init_validate = __esm(() => {
  init_regex();
  validate_default = validate;
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/parse.js
function parse(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  let v;
  return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, v >>> 16 & 255, v >>> 8 & 255, v & 255, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255, v / 4294967296 & 255, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
}
var parse_default;
var init_parse = __esm(() => {
  init_validate();
  parse_default = parse;
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/stringify.js
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
var byteToHex;
var init_stringify = __esm(() => {
  byteToHex = [];
  for (let i = 0;i < 256; ++i) {
    byteToHex.push((i + 256).toString(16).slice(1));
  }
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/v35.js
function stringToBytes(str) {
  str = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(str.length);
  for (let i = 0;i < str.length; ++i) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}
function v35(version, hash, value, namespace, buf, offset) {
  const valueBytes = typeof value === "string" ? stringToBytes(value) : value;
  const namespaceBytes = typeof namespace === "string" ? parse_default(namespace) : namespace;
  if (typeof namespace === "string") {
    namespace = parse_default(namespace);
  }
  if (namespace?.length !== 16) {
    throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
  }
  let bytes = new Uint8Array(16 + valueBytes.length);
  bytes.set(namespaceBytes);
  bytes.set(valueBytes, namespaceBytes.length);
  bytes = hash(bytes);
  bytes[6] = bytes[6] & 15 | version;
  bytes[8] = bytes[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0;i < 16; ++i) {
      buf[offset + i] = bytes[i];
    }
    return buf;
  }
  return unsafeStringify(bytes);
}
var DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8", URL2 = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
var init_v35 = __esm(() => {
  init_parse();
  init_stringify();
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/v5.js
function v5(value, namespace, buf, offset) {
  return v35(80, sha1_default, value, namespace, buf, offset);
}
var v5_default;
var init_v5 = __esm(() => {
  init_sha1();
  init_v35();
  v5.DNS = DNS;
  v5.URL = URL2;
  v5_default = v5;
});

// ../../node_modules/.bun/uuid@13.0.2/node_modules/uuid/dist-node/index.js
var init_dist_node = __esm(() => {
  init_v5();
  init_validate();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array, separator = "|") {
  return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}

class Cached {
  constructor(getter) {
    this._getter = getter;
    this._value = undefined;
  }
  get value() {
    const getter = this._getter;
    if (getter !== undefined) {
      this._value = getter();
      this._getter = undefined;
    }
    return this._value;
  }
}
function cached(getter) {
  return new Cached(getter);
}
function nullish(input) {
  return input === null || input === undefined;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function rawShape(def) {
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
  return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
  Object.defineProperty(target, key, {
    get() {
      const value = getter();
      assignProp(this, key, value);
      return value;
    },
    enumerable: true,
    configurable: true
  });
}
function putProp(target, key, value) {
  if (key in target)
    assignProp(target, key, value);
  else
    target[key] = value;
}
function mirrorShape(target, source, keys, wrap) {
  const raw = sourceShape(source);
  for (const key of keys) {
    const desc = Object.getOwnPropertyDescriptor(raw, key);
    if (!desc.enumerable)
      continue;
    if (desc.get) {
      deferProp(target, key, () => {
        const value = source._zod.def.shape[key];
        return wrap ? wrap(value, key) : value;
      });
    } else
      putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
  }
}
function mirrorProps(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!desc.enumerable)
      continue;
    if (desc.get)
      deferProp(target, key, () => source[key]);
    else
      putProp(target, key, desc.value);
  }
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === undefined)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== undefined) {
    if (params?.error !== undefined)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin !== undefined && shape[k]._zod.optout === "optional";
  });
}
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const newShape = {};
  mirrorShape(newShape, schema, maskedKeys(schema, mask));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function maskedKeys(schema, mask) {
  const raw = sourceShape(schema);
  const keys = [];
  for (const key of Reflect.ownKeys(mask)) {
    if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) {
      throw new Error(`Unrecognized key: "${String(key)}"`);
    }
    if (mask[key])
      keys.push(key);
  }
  return keys;
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const omitted = new Set(maskedKeys(schema, mask));
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = sourceShape(schema);
    for (const key of Reflect.ownKeys(shape)) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== undefined) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
  mirrorProps(newShape, shape);
  return newShape;
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
  if (!b?._zod?.def) {
    throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
  }
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const newShape = {};
  mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
  mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
  const def = mergeDefs(a._zod.def, {
    shape: newShape,
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class, schema, mask, name = "partial") {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
  }
  const selected = mask ? new Set(maskedKeys(schema, mask)) : undefined;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({ type: "optional", innerType: value })));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape, checks: [] }));
}
function required(Class, schema, mask) {
  const selected = mask ? new Set(maskedKeys(schema, mask)) : undefined;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({ type: "nonoptional", innerType: value }));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a;
    (_a = iss).path ?? (_a.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function sizeCaps(defChecks) {
  const caps = [];
  for (const ch of defChecks ?? []) {
    const d = ch._zod.def;
    if (!/_(length|size)$|_equals$/.test(d.check))
      break;
    const max = d.maximum ?? d.length ?? d.size;
    if (max >= 0)
      caps.push([max, ch]);
  }
  return caps;
}
function attachSchema(issues, start, inst) {
  var _a;
  for (let i = start;i < issues.length; i++) {
    (_a = issues[i]).schema ?? (_a.schema = inst);
  }
}
function finalizeIssue(iss, ctx, config) {
  var _a;
  const traits = iss.inst?._zod?.traits;
  if (traits?.has("$ZodType")) {
    if (traits.has("$ZodCheck"))
      (_a = iss).schema ?? (_a.schema = iss.inst);
    else
      iss.schema = iss.inst;
  }
  const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : undefined;
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
  const full = {};
  for (const k of Object.keys(iss)) {
    if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__")
      continue;
    full[k] = iss[k];
  }
  full.path ?? (full.path = []);
  full.message = message;
  if (ctx?.reportInput) {
    full.input = iss.input;
  }
  return full;
}
function codePointLength(str) {
  const units = str.length;
  if (!highSurrogate.test(str))
    return units;
  let count = units;
  for (let i = 0;i < units - 1; i++) {
    if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
      count--;
      i++;
    }
  }
  return count;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function members(proto, table) {
  for (const key in table) {
    const desc = Object.getOwnPropertyDescriptor(table, key);
    if (desc.get)
      Object.defineProperty(proto, key, { ...desc, enumerable: false });
    else
      defineBound(proto, key, desc.value);
  }
}
function own(inst, key, value, enumerable = true) {
  Object.defineProperty(inst, key, { configurable: true, writable: true, enumerable, value });
  return value;
}
function hide(inst, key, value) {
  return own(inst, key, value, false);
}
function derived(computes, table) {
  for (const key in computes) {
    const compute = computes[key];
    Object.defineProperty(table, key, {
      configurable: true,
      enumerable: true,
      get() {
        return own(this, key, compute(this));
      },
      set(value) {
        own(this, key, value);
      }
    });
  }
  return table;
}
function defineBound(proto, key, fn) {
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      return this == null ? fn : own(this, key, fn.bind(this));
    },
    set(value) {
      own(this, key, value);
    }
  });
}
function claim(inst, sentinel) {
  const proto = Object.getPrototypeOf(inst);
  return sentinel in proto ? undefined : proto;
}
function defineLazyInternal(inst, key, compute) {
  const proto = Object.getPrototypeOf(inst._zod);
  if (key in proto && installing !== inst._zod) {
    installing = undefined;
    return;
  }
  installing = inst._zod;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      Object.defineProperty(this, key, breaker);
      const outer = broke;
      broke = false;
      try {
        const value = compute(this);
        if (broke)
          delete this[key];
        else
          Object.defineProperty(this, key, { configurable: true, writable: true, value });
        broke = broke || outer;
        return value;
      } catch (err) {
        delete this[key];
        broke = broke || outer;
        throw err;
      }
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, value });
    }
  });
}
function installLazyProp(inst, key, make, enumerable) {
  const proto = claim(inst, key);
  if (!proto)
    return;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      const desc = { configurable: true, writable: true, enumerable, value: undefined };
      Object.defineProperty(this, key, desc);
      desc.value = make(this);
      Object.defineProperty(this, key, desc);
      return desc.value;
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, enumerable, value });
    }
  });
}
function constantCatch(value) {
  const fn = () => value;
  fn[CONSTANT_CATCH] = true;
  return fn;
}
var captureStackTrace, allowsEval, propertyKeyTypes, NUMBER_FORMAT_RANGES, BIGINT_FORMAT_RANGES, highSurrogate, installing, broke = false, breaker, CONSTANT_CATCH = "~constantCatch";
var init_util = __esm(() => {
  init_core();
  captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
  allowsEval = /* @__PURE__ */ cached(() => {
    if (globalConfig.jitless) {
      return false;
    }
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
      return false;
    }
    try {
      const F = Function;
      new F("");
      return true;
    } catch (_) {
      return false;
    }
  });
  propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
  NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-340282346638528860000000000000000000000, 340282346638528860000000000000000000000],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
  }))();
  BIGINT_FORMAT_RANGES = {
    int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
    uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
  };
  highSurrogate = /[\uD800-\uDBFF]/;
  breaker = {
    configurable: true,
    get() {
      broke = true;
      return;
    }
  };
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/core.js
function newError(Definition) {
  const E = _E;
  if (E) {
    const saved = E.stackTraceLimit;
    if (typeof saved === "number") {
      try {
        E.stackTraceLimit = 0;
      } catch {
        _E = null;
        return new Definition;
      }
      try {
        return new Definition;
      } finally {
        E.stackTraceLimit = saved;
      }
    }
  }
  return new Definition;
}
function $constructor(name, initializer, proto, params) {
  const zodProto = {};
  function Internals(def) {
    this.def = def;
    this.constr = _;
    this.traits = new Set;
  }
  Internals.prototype = zodProto;
  const protoMembers = proto;
  const initialized = protoMembers && new WeakSet;
  function init(inst, def) {
    if (!inst._zod) {
      _zodDesc.value = new Internals(def);
      try {
        Object.defineProperty(inst, "_zod", _zodDesc);
      } finally {
        _zodDesc.value = undefined;
      }
    } else if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer(inst, def);
    if (initialized) {
      const own = Object.getPrototypeOf(inst);
      const ctorProto = inst._zod.constr.prototype;
      let up = own;
      while (up && up !== ctorProto)
        up = Object.getPrototypeOf(up);
      const target = up ?? own;
      if (!initialized.has(target)) {
        initialized.add(target);
        members(target, protoMembers);
      }
    }
    const proto = _.prototype;
    for (const k in proto) {
      if (!Object.prototype.hasOwnProperty.call(proto, k))
        continue;
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;

  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    const inst = params?.Parent ? newError(Definition) : this;
    init(inst, def);
    const deferred = inst._zod.deferred;
    if (deferred) {
      for (const fn of deferred) {
        fn();
      }
      inst._zod.deferred = undefined;
    }
    const pp = globalThis.__zod_globalConfig?.postProcessor;
    if (pp)
      pp(inst);
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}
var _a, _zodDesc, _E, $ZodAsyncError, $ZodEncodeError, globalConfig;
var init_core = __esm(() => {
  init_util();
  _zodDesc = { value: undefined, enumerable: false };
  _E = "captureStackTrace" in Error ? Error : null;
  $ZodAsyncError = class $ZodAsyncError extends Error {
    constructor() {
      super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
  };
  $ZodEncodeError = class $ZodEncodeError extends Error {
    constructor(name) {
      super(`Encountered unidirectional transform during encode: ${name}`);
      this.name = "ZodEncodeError";
    }
  };
  (_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
  globalConfig = globalThis.__zod_globalConfig;
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/errors.js
function _getMessage() {
  const internals = this._zod;
  internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
  return internals.message;
}
function _setMessage(value) {
  this._zod.message = value;
}
function node(obj, key, make) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    if (key === "__proto__") {
      Object.defineProperty(obj, key, { value: make(), writable: true, enumerable: true, configurable: true });
    } else {
      obj[key] = make();
    }
  }
  return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue) => issue.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error, path = []) => {
    for (const issue of error.issues) {
      if (issue.code === "invalid_union" && issue.errors.length) {
        issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
      } else if (issue.code === "invalid_key") {
        processError({ issues: issue.issues }, [...path, ...issue.path]);
      } else if (issue.code === "invalid_element") {
        processError({ issues: issue.issues }, [...path, ...issue.path]);
      } else {
        const fullpath = [...path, ...issue.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (el === "_errors") {
              if (terminal)
                curr._errors.push(mapper(issue));
              i++;
              continue;
            }
            if (!Object.prototype.hasOwnProperty.call(curr, el)) {
              Object.defineProperty(curr, el, {
                value: { _errors: [] },
                enumerable: true,
                writable: true,
                configurable: true
              });
            }
            const node = curr[el];
            if (terminal) {
              node._errors.push(mapper(issue));
            }
            curr = node;
            i++;
          }
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}
var _messageDesc, _issuesDesc, _installedToString, initializer = (inst, def) => {
  inst.name = "$ZodError";
  _issuesDesc.value = def;
  Object.defineProperty(inst, "issues", _issuesDesc);
  _issuesDesc.value = undefined;
  Object.defineProperty(inst, "message", _messageDesc);
  const proto = Object.getPrototypeOf(inst);
  if (!_installedToString.has(proto)) {
    _installedToString.add(proto);
    Object.defineProperty(proto, "toString", {
      configurable: true,
      enumerable: false,
      get() {
        const value = () => this.message;
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
        return value;
      },
      set(value) {
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
      }
    });
  }
}, $ZodError, $ZodRealError;
var init_errors = __esm(() => {
  init_core();
  init_util();
  _messageDesc = {
    get: _getMessage,
    set: _setMessage,
    enumerable: true,
    configurable: true
  };
  _issuesDesc = { value: undefined, enumerable: false };
  _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
  $ZodError = $constructor("$ZodError", initializer);
  $ZodRealError = $constructor("$ZodError", initializer, undefined, {
    Parent: Error
  });
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
  return { callee: params?.callee ?? callee, Err: params?.Err };
}
function failure(Err, issues, ctx) {
  let error;
  return {
    success: false,
    get error() {
      if (!error) {
        error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
        issues = undefined;
        ctx = undefined;
      }
      return error;
    },
    set error(e) {
      error = e;
      issues = undefined;
      ctx = undefined;
    }
  };
}
function validateFallback(schema, value, _ctx) {
  const ctx = _ctx ? { ..._ctx, async: false, abortEarly: true } : { async: false, abortEarly: true };
  const fallbackRun = schema._zod.bag.fallbackRun;
  let result;
  if (fallbackRun) {
    ctx[COMPILE_FALLBACK] = true;
    result = fallbackRun({ value, issues: [] }, ctx);
  } else {
    result = schema._zod.run({ value, issues: [] }, ctx);
  }
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length === 0;
}
var _parse = (_Err) => {
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError;
    }
    if (result.issues.length) {
      const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, _params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
}, _parseAsync = (_Err) => {
  const fn = async (schema, value, _ctx, params) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    if (result.issues.length) {
      const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
}, _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
}, _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
}, COMPILE_INVALID, COMPILE_FALLBACK, validate2 = (schema, value, _ctx) => {
  const validator = schema._zod.bag.validator;
  if (validator !== undefined) {
    if (validator(value) !== COMPILE_INVALID)
      return true;
    if (validator.definite === true && _ctx === undefined)
      return false;
  }
  return validateFallback(schema, value, _ctx);
}, validateAsync = async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true, abortEarly: true } : { async: true, abortEarly: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length === 0;
}, _encode = (_Err) => {
  const parse = _parse(_Err);
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return parse(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
}, _decode = (_Err) => {
  const parse = _parse(_Err);
  const fn = (schema, value, _ctx, _params) => {
    return parse(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
}, _encodeAsync = (_Err) => {
  const parseAsync = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
}, _decodeAsync = (_Err) => {
  const parseAsync = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
}, _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
}, _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
}, _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
}, _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
var init_parse2 = __esm(() => {
  init_core();
  init_util();
  COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
  COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/regexes.js
function nanoidOfLength(length) {
  return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
function emoji() {
  return new RegExp(_emoji, "u");
}
function anchor(source) {
  return new RegExp(`^${source}$`);
}
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const opts = ["Z"];
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const qualified = `${timeSource({ precision: args.precision, seconds: true })}(?:${opts.join("|")})`;
  const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var cuid, cuid2, ulid, xid, ksuid, nanoid, duration, guid, uuid = (version) => {
  if (!version)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
}, email, _emoji = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`, ipv4, ipv6, cidrv4, cidrv6, base64, base64url, httpProtocol, e164, dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`, date, anyString, integer, number, boolean, lowercase, uppercase;
var init_regexes = __esm(() => {
  cuid = /^[cC][0-9a-z]{6,}$/;
  cuid2 = /^[0-9a-z]+$/;
  ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
  xid = /^[0-9a-vA-V]{20}$/;
  ksuid = /^[A-Za-z0-9]{27}$/;
  nanoid = /^[a-zA-Z0-9_-]{21}$/;
  duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
  guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
  ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
  cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
  cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
  base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
  httpProtocol = /^https?$/;
  e164 = /^\+[1-9]\d{6,14}$/;
  date = /* @__PURE__ */ anchor(dateSource);
  anyString = /^[\s\S]{0,}$/;
  integer = /^-?\d+$/;
  number = /^-?\d+(?:\.\d+)?$/;
  boolean = /^(?:true|false)$/i;
  lowercase = /^[^A-Z]*$/;
  uppercase = /^[^a-z]*$/;
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/checks.js
var $ZodCheck, _whenHasLength = (payload) => {
  const val = payload.value;
  return !nullish(val) && val.length !== undefined;
}, numericOriginMap, $ZodCheckLessThan, $ZodCheckGreaterThan, $ZodCheckMultipleOf, $ZodCheckNumberFormat, $ZodCheckMaxLength, $ZodCheckMinLength, $ZodCheckLengthEquals, $ZodCheckStringFormat, $ZodCheckRegex, $ZodCheckLowerCase, $ZodCheckUpperCase, $ZodCheckIncludes, $ZodCheckStartsWith, $ZodCheckEndsWith, $ZodCheckOverwrite;
var init_checks = __esm(() => {
  init_core();
  init_regexes();
  init_util();
  $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
    var _a;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a = inst._zod).onattach ?? (_a.onattach = []);
  });
  numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date"
  };
  $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
        return;
      }
      payload.issues.push({
        origin: numericOriginMap[typeof payload.value] ?? origin,
        code: "too_big",
        maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
        return;
      }
      payload.issues.push({
        origin: numericOriginMap[typeof payload.value] ?? origin,
        code: "too_small",
        minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      if (typeof payload.value !== typeof def.value)
        throw new Error("Cannot mix number and bigint in multiple_of check.");
      const isMultiple = typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
      if (isMultiple)
        return;
      payload.issues.push({
        origin: typeof payload.value,
        code: "not_multiple_of",
        divisor: def.value,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def);
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
    inst._zod.check = (payload) => {
      const input = payload.value;
      if (isInt) {
        if (!Number.isInteger(input)) {
          payload.issues.push({
            expected: origin,
            format: def.format,
            code: "invalid_type",
            continue: false,
            input,
            inst
          });
          return;
        }
        if (!Number.isSafeInteger(input)) {
          if (input > 0) {
            payload.issues.push({
              input,
              code: "too_big",
              maximum: Number.MAX_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              inclusive: true,
              continue: !def.abort
            });
          } else {
            payload.issues.push({
              input,
              code: "too_small",
              minimum: Number.MIN_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              inclusive: true,
              continue: !def.abort
            });
          }
          return;
        }
      }
      if (input < minimum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_small",
          minimum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
      if (input > maximum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_big",
          maximum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
    inst._zod.check = (payload) => {
      const input = payload.value;
      const units = input.length;
      const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
      if (length <= def.maximum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_big",
        maximum: def.maximum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
    inst._zod.check = (payload) => {
      const input = payload.value;
      const units = input.length;
      const length = typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units;
      if (length >= def.minimum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_small",
        minimum: def.minimum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
    inst._zod.check = (payload) => {
      const input = payload.value;
      const units = input.length;
      const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
      if (length === def.length)
        return;
      const origin = getLengthableOrigin(input);
      const tooBig = length > def.length;
      payload.issues.push({
        origin,
        ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
        inclusive: true,
        exact: true,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a, _b;
    $ZodCheck.init(inst, def);
    if (def.pattern)
      (_a = inst._zod).check ?? (_a.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: def.format,
          input: payload.value,
          ...def.pattern ? { pattern: def.pattern.toString() } : {},
          inst,
          continue: !def.abort
        });
      });
    else
      (_b = inst._zod).check ?? (_b.check = () => {});
  });
  $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "regex",
        input: payload.value,
        pattern: def.pattern.toString(),
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = lowercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = uppercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.check = (payload) => {
      if (payload.value.includes(def.includes, def.position))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "includes",
        includes: def.includes,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.check = (payload) => {
      if (payload.value.startsWith(def.prefix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "starts_with",
        prefix: def.prefix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.check = (payload) => {
      if (payload.value.endsWith(def.suffix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "ends_with",
        suffix: def.suffix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      payload.value = def.tx(payload.value);
    };
  });
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/doc.js
class Doc {
  constructor(args = [], closed = {}) {
    this.content = [];
    this.indent = 0;
    this.args = args;
    this.closed = closed;
  }
  indented(fn) {
    this.indent += 1;
    try {
      fn(this);
    } finally {
      this.indent -= 1;
    }
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split(`
`).filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const content = this?.content ?? [``];
    const factory = new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${content.join(`
`)}
};`);
    return factory(...Object.values(this.closed));
  }
}

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/versions.js
var version;
var init_versions = __esm(() => {
  version = {
    major: 4,
    minor: 6,
    patch: 7
  };
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/schemas.js
async function validateAsync2(inst, value) {
  const ctx = { async: true };
  return toStandardResult(await inst._zod.run({ value, issues: [] }, ctx), ctx);
}
function standardProps(inst) {
  return {
    validate: (value) => {
      const ctx = { async: false };
      try {
        const r = inst._zod.run({ value, issues: [] }, ctx);
        if (!(r instanceof Promise))
          return toStandardResult(r, ctx);
      } catch (_) {}
      return validateAsync2(inst, value);
    },
    vendor: "zod",
    version: 1
  };
}
function canParseURL(input) {
  try {
    if (typeof URL !== "undefined" && typeof URL.canParse === "function")
      return URL.canParse(input);
    new URL(input);
    return true;
  } catch {
    return false;
  }
}
function validateURL(trimmed, def) {
  if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) {
    return canParseURL(trimmed) || URL_UNPARSEABLE;
  }
  return parseURLObject(trimmed, def);
}
function parseURLObject(trimmed, def) {
  if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) {
    return URL_BAD_FORMAT;
  }
  try {
    if (typeof URL !== "undefined") {
      const URLStatic = URL;
      if (typeof URLStatic.parse === "function")
        return URLStatic.parse(trimmed) ?? URL_UNPARSEABLE;
    }
    return new URL(trimmed);
  } catch {
    return URL_UNPARSEABLE;
  }
}
function stripTabAndNewline(value) {
  return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
  hostname.lastIndex = 0;
  return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
  protocol.lastIndex = 0;
  return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
function isValidIPv6(value) {
  if (!ipv6Alphabet.test(value))
    return false;
  return canParseURL(`http://[${value}]`);
}
function isValidCIDRv6(value) {
  const parts = value.split("/");
  if (parts.length !== 2)
    return false;
  const [address, prefix] = parts;
  if (!prefix)
    return false;
  const prefixNum = Number(prefix);
  if (`${prefixNum}` !== prefix)
    return false;
  if (prefixNum < 0 || prefixNum > 128)
    return false;
  return isValidIPv6(address);
}
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
function isValidBase64URL(data) {
  if (!base64urlCharset.test(data))
    return false;
  const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return isValidBase64(padded);
}
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
function capSize(inst, size) {
  const caps = sizeCaps(inst._zod.def.checks);
  if (!caps.length)
    return;
  const cap = Math.min(...caps.map((c) => c[0]));
  const parse = inst._zod.parse;
  inst._zod.parse = (payload, ctx) => {
    const n = size(payload.value);
    if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
      for (const [max, ch] of sizeCaps(inst._zod.def.checks)) {
        if (n > max && ch._zod.def.when(payload)) {
          const start = payload.issues.length;
          ch._zod.check(payload);
          payload.issues[start].continue = false;
          attachSchema(payload.issues, start, inst);
          return payload;
        }
      }
    }
    return parse(payload, ctx);
  };
}
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handlePropertyResult(result, final, key, input, optin, optout) {
  const isPresent = key in input;
  const isOptionalOut = optout === "optional";
  if (!isPresent && isOptionalOut && optin === "optional") {
    return;
  }
  if (result.issues.length) {
    if (optin !== undefined && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && optin === undefined) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: undefined,
        path: [key]
      });
    }
    return;
  }
  if (result.value === undefined) {
    if (isPresent || optin === "defaulted" && !isOptionalOut) {
      final.value[key] = undefined;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  const ownSymbols = Object.getOwnPropertySymbols(def.shape);
  const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
  const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
  for (const k of allKeys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    allKeys,
    symbolKeys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const optin = _catchall.optin;
  const optout = _catchall.optout;
  let seen = 0;
  for (const key in input) {
    if (abortEarly && payload.issues.length !== seen) {
      if (aborted(payload, seen))
        break;
      seen = payload.issues.length;
    }
    if (keySet.has(key))
      continue;
    if (key === "__proto__") {
      if (t === "never")
        unrecognized.push(key);
      continue;
    }
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
    } else {
      handlePropertyResult(r, payload, key, input, optin, optout);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst,
      continue: true
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    if (Object.prototype.hasOwnProperty.call(newObj, "__proto__"))
      delete newObj.__proto__;
    for (const key of sharedKeys) {
      if (key === "__proto__")
        continue;
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = new Map;
  let unrecIssue;
  const keyIssues = new Map;
  const collect = (iss, side) => {
    let keys;
    if (iss.code === "unrecognized_keys" && !iss.path?.length) {
      unrecIssue ?? (unrecIssue = iss);
      keys = iss.keys;
    } else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
      const k = String(iss.path[0]);
      if (!keyIssues.has(k))
        keyIssues.set(k, iss);
      keys = [k];
    } else {
      return false;
    }
    for (const k of keys) {
      if (!unrecKeys.has(k))
        unrecKeys.set(k, {});
      unrecKeys.get(k)[side] = true;
    }
    return true;
  };
  for (const iss of left.issues) {
    if (!collect(iss, "l"))
      result.issues.push(iss);
  }
  for (const iss of right.issues) {
    if (!collect(iss, "r"))
      result.issues.push(iss);
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length) {
    const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
    if (aggregated.length)
      result.issues.push({ ...unrecIssue, keys: aggregated });
    for (const k of bothKeys) {
      if (!aggregated.includes(k) && keyIssues.has(k))
        result.issues.push(keyIssues.get(k));
    }
  }
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    if (aborted(result))
      return result;
    throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
function handleOptionalResult(payload, result) {
  payload.value = result.issues.length ? undefined : result.value;
  return payload;
}
function handleDefaultResult(payload, def) {
  if (payload.value === undefined) {
    payload.value = def.defaultValue;
  }
  return payload;
}
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === undefined) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handleCatchResult(payload, result, def, ctx) {
  if (!result.issues.length) {
    payload.value = result.value;
    if (result.memo)
      payload.memo = true;
    return payload;
  }
  payload.value = def.catchValue({
    ...result,
    value: payload.value,
    error: {
      issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
    },
    input: payload.value
  });
  return payload;
}
function handlePipeResult(left, next, ctx) {
  if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
function handleReadonlyResult(payload) {
  if (!payload.memo)
    payload.value = Object.freeze(payload.value);
  return payload;
}
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      path: [...inst._zod.def.path ?? []],
      continue: !inst._zod.def.abort
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
var $ZodType, toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value }, $ZodString, $ZodStringFormat, $ZodGUID, $ZodUUID, $ZodEmail, URL_BAD_FORMAT = 1, URL_UNPARSEABLE = 2, asciiTabOrNewline, $ZodURL, $ZodEmoji, $ZodNanoID, $ZodCUID, $ZodCUID2, $ZodULID, $ZodXID, $ZodKSUID, $ZodISODateTime, $ZodISODate, $ZodISOTime, $ZodISODuration, $ZodIPv4, ipv6Alphabet, $ZodIPv6, $ZodCIDRv4, $ZodCIDRv6, base64Charset, $ZodBase64, base64urlCharset, $ZodBase64URL, $ZodE164, $ZodJWT, $ZodNumber, $ZodNumberFormat, $ZodBoolean, $ZodUnknown, $ZodNever, arraySize = (input) => Array.isArray(input) ? input.length : -1, $ZodArray, NO_SYMBOL_KEYS, $ZodObject, $ZodObjectJIT, $ZodUnion, $ZodIntersection, $ZodRecord, $ZodEnum, $ZodTransform, $ZodOptional, $ZodExactOptional, $ZodNullable, $ZodDefault, $ZodPrefault, $ZodNonOptional, $ZodCatch, $ZodPipe, $ZodPreprocess, $ZodReadonly, $ZodCustom;
var init_schemas = __esm(() => {
  init_checks();
  init_core();
  init_regexes();
  init_util();
  init_versions();
  init_util();
  $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def;
    inst._zod.bag = inst._zod.bag || {};
    inst._zod.version = version;
    const defChecks = inst._zod.def.checks;
    const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
    for (const ch of checks) {
      for (const fn of ch._zod.onattach) {
        fn(inst);
      }
    }
    if (checks.length === 0) {
      (_a = inst._zod).deferred ?? (_a.deferred = []);
      inst._zod.deferred?.push(() => {
        inst._zod.run = inst._zod.parse;
      });
    } else {
      const runChecks = (payload, checks, ctx) => {
        if (payload.memo)
          return payload;
        let isAborted = aborted(payload);
        let asyncResult;
        for (const ch of checks) {
          if (ch._zod.def.when) {
            if (explicitlyAborted(payload))
              continue;
            const shouldRun = ch._zod.def.when(payload);
            if (!shouldRun)
              continue;
          } else if (isAborted) {
            continue;
          }
          const currLen = payload.issues.length;
          const _ = ch._zod.check(payload);
          if (_ instanceof Promise && ctx?.async === false) {
            throw new $ZodAsyncError;
          }
          if (asyncResult || _ instanceof Promise) {
            asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
              await _;
              const nextLen = payload.issues.length;
              if (nextLen === currLen)
                return;
              attachSchema(payload.issues, currLen, inst);
              if (!isAborted)
                isAborted = aborted(payload, currLen);
            });
          } else {
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              continue;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          }
        }
        if (asyncResult) {
          return asyncResult.then(() => {
            return payload;
          });
        }
        return payload;
      };
      const handleCanaryResult = (canary, payload, ctx) => {
        if (aborted(canary)) {
          canary.aborted = true;
          return canary;
        }
        const checkResult = runChecks(payload, checks, ctx);
        if (checkResult instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError;
          return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
        }
        return inst._zod.parse(checkResult, ctx);
      };
      inst._zod.run = (payload, ctx) => {
        if (ctx.skipChecks) {
          return inst._zod.parse(payload, ctx);
        }
        if (ctx.direction === "backward") {
          const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
          if (canary instanceof Promise) {
            return canary.then((canary) => {
              return handleCanaryResult(canary, payload, ctx);
            });
          }
          return handleCanaryResult(canary, payload, ctx);
        }
        const result = inst._zod.parse(payload, ctx);
        if (result instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError;
          return result.then((result) => runChecks(result, checks, ctx));
        }
        return runChecks(result, checks, ctx);
      };
    }
  }, {
    get "~standard"() {
      return hide(this, "~standard", standardProps(this));
    },
    set "~standard"(value) {
      own(this, "~standard", value);
    }
  });
  $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = def.pattern ?? anyString;
    inst._zod.parse = (payload, _) => {
      if (def.coerce)
        try {
          payload.value = String(payload.value);
        } catch (_) {}
      if (typeof payload.value === "string")
        return payload;
      payload.issues.push({
        expected: "string",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
  });
  $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = guid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
      const versionMap = {
        v1: 1,
        v2: 2,
        v3: 3,
        v4: 4,
        v5: 5,
        v6: 6,
        v7: 7,
        v8: 8
      };
      const v = versionMap[def.version];
      if (v === undefined)
        throw new Error(`Invalid UUID version: "${def.version}"`);
      def.pattern ?? (def.pattern = uuid(v));
    } else
      def.pattern ?? (def.pattern = uuid());
    $ZodStringFormat.init(inst, def);
  });
  $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = email);
    $ZodStringFormat.init(inst, def);
  });
  asciiTabOrNewline = /[\t\n\r]/g;
  $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      try {
        const trimmed = payload.value.trim();
        const url = validateURL(trimmed, def);
        if (url === URL_BAD_FORMAT) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
        if (url === URL_UNPARSEABLE) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
        if (url === true) {
          payload.value = stripTabAndNewline(trimmed);
          return;
        }
        if (def.hostname && !urlHostnameOk(url, def.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
        if (def.protocol && !urlProtocolOk(url, def.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
        payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
        return;
      } catch (_) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = emoji());
    $ZodStringFormat.init(inst, def);
  });
  $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
    if (def.length !== undefined && (!Number.isInteger(def.length) || def.length < 1))
      throw new Error(`Invalid nanoid length: ${def.length}`);
    def.pattern ?? (def.pattern = def.length === undefined ? nanoid : nanoidOfLength(def.length));
    $ZodStringFormat.init(inst, def);
  });
  $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = cuid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = cuid2);
    $ZodStringFormat.init(inst, def);
  });
  $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = ulid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = xid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = ksuid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = datetime(def));
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = date);
    $ZodStringFormat.init(inst, def);
  });
  $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = time(def));
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = duration);
    $ZodStringFormat.init(inst, def);
  });
  $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = ipv4);
    $ZodStringFormat.init(inst, def);
  });
  ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
  $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (!isValidIPv6(payload.value)) {
        payload.issues.push({
          code: "invalid_format",
          format: "ipv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv4);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (!isValidCIDRv6(payload.value)) {
        payload.issues.push({
          code: "invalid_format",
          format: "cidrv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
  $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = base64Charset);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidBase64(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  base64urlCharset = /^[A-Za-z0-9_-]*$/;
  $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = base64urlCharset);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidBase64URL(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = e164);
    $ZodStringFormat.init(inst, def);
  });
  $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidJWT(payload.value, def.alg))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "jwt",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = number;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Number(payload.value);
        } catch (_) {}
      const input = payload.value;
      if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
        return payload;
      }
      const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : undefined : undefined;
      payload.issues.push({
        expected: "number",
        code: "invalid_type",
        input,
        inst,
        ...received ? { received } : {}
      });
      return payload;
    };
  });
  $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
    $ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def);
  });
  $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Boolean(payload.value);
        } catch (_) {}
      const input = payload.value;
      if (typeof input === "boolean")
        return payload;
      payload.issues.push({
        expected: "boolean",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
  });
  $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      payload.issues.push({
        expected: "never",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    const memo = globalConfig.memoizer;
    memo?.attach(inst);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!Array.isArray(input)) {
        payload.issues.push({
          expected: "array",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
      const proms = [];
      const abortEarly = ctx?.abortEarly;
      for (let i = 0;i < input.length; i++) {
        const item = input[i];
        const result = def.element._zod.run({
          value: item,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result) => handleArrayResult(result, payload, i)));
        } else {
          handleArrayResult(result, payload, i);
          if (abortEarly && result.issues.length !== 0 && aborted(result))
            break;
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
    capSize(inst, arraySize);
  });
  NO_SYMBOL_KEYS = [];
  $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
    $ZodType.init(inst, def);
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    const sh = desc?.get ? desc.get.raw : def.shape ?? {};
    if (sh) {
      const get = () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", { value: newSh });
        get.raw = newSh;
        return newSh;
      };
      get.raw = sh;
      Object.defineProperty(def, "shape", { get });
    }
    const _normalized = cached(() => normalizeDef(def));
    defineLazyInternal(inst, "propValues", (zod) => {
      const shape = zod.def.shape;
      const propValues = {};
      for (const key in shape) {
        const field = shape[key]._zod;
        if (field.values) {
          if (!Object.prototype.hasOwnProperty.call(propValues, key)) {
            assignProp(propValues, key, new Set);
          }
          for (const v of field.values)
            propValues[key].add(v);
          if (field.optin !== undefined)
            propValues[key].add(undefined);
        }
      }
      return propValues;
    });
    const isObject2 = isObject;
    const catchall = def.catchall;
    let value;
    const memo = globalConfig.memoizer;
    memo?.attach(inst);
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
      const proms = [];
      const shape = value.shape;
      const abortEarly = ctx?.abortEarly;
      let seen = payload.issues.length;
      for (const key of value.allKeys) {
        if (abortEarly && payload.issues.length !== seen) {
          if (aborted(payload, seen))
            break;
          seen = payload.issues.length;
        }
        if (key === "__proto__")
          continue;
        const el = shape[key];
        const optin = el._zod.optin;
        const optout = el._zod.optout;
        const r = el._zod.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
          proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
        } else {
          handlePropertyResult(r, payload, key, input, optin, optout);
        }
      }
      if (!catchall) {
        return proms.length ? Promise.all(proms).then(() => payload) : payload;
      }
      return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
    };
  });
  $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
    $ZodObject.init(inst, def);
    const superParse = inst._zod.parse;
    const _normalized = cached(() => normalizeDef(def));
    const memo = globalConfig.memoizer;
    const generateFastpass = (shape) => {
      const normalized = _normalized.value;
      const syms = normalized.symbolKeys;
      const doc = new Doc(["payload", "ctx"], { shape, inst, memo, syms });
      const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
      const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
      doc.write(`const input = payload.value;`);
      const ids = Object.create(null);
      let counter = 0;
      for (const key of normalized.allKeys) {
        ids[key] = `key_${counter++}`;
      }
      doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
      for (const key of normalized.allKeys) {
        if (key === "__proto__")
          continue;
        const id = ids[key];
        const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
        const isPresent = `${k} in input`;
        const schema = shape[key];
        const optin = schema?._zod?.optin;
        const isOptionalIn = optin !== undefined;
        const isOptionalOut = schema?._zod?.optout === "optional";
        doc.write(`const ${id} = ${parseStr(k)};`);
        if (isOptionalIn && isOptionalOut) {
          const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
          doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
        } else if (!isOptionalIn) {
          doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
        } else {
          doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
          if (optin === "defaulted") {
            doc.write(`newResult[${k}] = ${id}.value;`);
          } else {
            doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
          }
        }
      }
      doc.write(`payload.value = newResult;`);
      doc.write(`return payload;`);
      return doc.compile();
    };
    let fastpass;
    const isObject2 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval2 = allowsEval;
    const fastEnabled = jit && allowsEval2.value;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
        if (!fastpass)
          fastpass = generateFastpass(def.shape);
        payload = fastpass(payload, ctx);
        if (!catchall)
          return payload;
        return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
      }
      return superParse(payload, ctx);
    };
  });
  $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== undefined) ? "optional" : undefined);
    defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazyInternal(inst, "values", (zod) => {
      if (zod.def.options.every((o) => o._zod.values)) {
        return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
      }
      return;
    });
    defineLazyInternal(inst, "pattern", (zod) => {
      if (zod.def.options.every((o) => o._zod.pattern)) {
        const patterns = zod.def.options.map((o) => o._zod.pattern);
        return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
      }
      return;
    });
    const first = def.options.length === 1 ? def.options[0]._zod.run : null;
    inst._zod.parse = (payload, ctx) => {
      if (first) {
        return first(payload, ctx);
      }
      let async = false;
      const results = [];
      for (const option of def.options) {
        const result = option._zod.run({
          value: payload.value,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          results.push(result);
          async = true;
        } else {
          if (result.issues.length === 0)
            return result;
          results.push(result);
        }
      }
      if (!async)
        return handleUnionResults(results, payload, inst, ctx);
      return Promise.all(results).then((results) => {
        return handleUnionResults(results, payload, inst, ctx);
      });
    };
  });
  $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      const left = def.left._zod.run({ value: input, issues: [] }, ctx);
      const right = def.right._zod.run({ value: input, issues: [] }, ctx);
      const async = left instanceof Promise || right instanceof Promise;
      if (async) {
        return Promise.all([left, right]).then(([left, right]) => {
          return handleIntersectionResults(payload, left, right);
        });
      }
      return handleIntersectionResults(payload, left, right);
    };
  });
  $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    const memo = globalConfig.memoizer;
    memo?.attach(inst);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isPlainObject(input)) {
        payload.issues.push({
          expected: "record",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      const proms = [];
      const values = def.keyType._zod.values;
      if (values && !def.partial) {
        payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
        const recordKeys = new Set;
        for (const key of values) {
          if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
            recordKeys.add(typeof key === "number" ? key.toString() : key);
            if (key === "__proto__")
              continue;
            const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
            if (keyResult instanceof Promise) {
              throw new Error("Async schemas not supported in object keys currently");
            }
            if (keyResult.issues.length) {
              payload.issues.push({
                code: "invalid_key",
                origin: "record",
                issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                input: key,
                path: [key],
                inst
              });
              continue;
            }
            const outKey = keyResult.value;
            if (outKey === "__proto__")
              continue;
            const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result) => {
                if (result.issues.length) {
                  payload.issues.push(...prefixIssues(key, result.issues));
                }
                payload.value[outKey] = result.value;
              }));
            } else {
              if (result.issues.length) {
                payload.issues.push(...prefixIssues(key, result.issues));
              }
              payload.value[outKey] = result.value;
            }
          }
        }
        let unrecognized;
        for (const key in input) {
          if (!recordKeys.has(key)) {
            if (def.mode === "loose") {
              if (key === "__proto__")
                continue;
              payload.value[key] = input[key];
            } else {
              unrecognized = unrecognized ?? [];
              unrecognized.push(key);
            }
          }
        }
        if (unrecognized && unrecognized.length > 0) {
          payload.issues.push({
            code: "unrecognized_keys",
            input,
            inst,
            keys: unrecognized,
            continue: true
          });
        }
      } else {
        payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
        let unrecognized;
        for (const key of Reflect.ownKeys(input)) {
          if (key === "__proto__")
            continue;
          if (!Object.prototype.propertyIsEnumerable.call(input, key))
            continue;
          let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
          if (checkNumericKey) {
            const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
            if (retryResult instanceof Promise) {
              throw new Error("Async schemas not supported in object keys currently");
            }
            if (retryResult.issues.length === 0) {
              keyResult = retryResult;
            }
          }
          if (keyResult.issues.length) {
            if (def.mode === "loose") {
              payload.value[key] = input[key];
            } else if (values) {
              unrecognized = unrecognized ?? [];
              unrecognized.push(key);
            } else {
              payload.issues.push({
                code: "invalid_key",
                origin: "record",
                issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                input: key,
                path: [key],
                inst
              });
            }
            continue;
          }
          const outKey = keyResult.value;
          if (outKey === "__proto__")
            continue;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result) => {
              if (result.issues.length) {
                payload.issues.push(...prefixIssues(key, result.issues));
              }
              payload.value[outKey] = result.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
        if (unrecognized && unrecognized.length > 0) {
          payload.issues.push({
            code: "unrecognized_keys",
            input,
            inst,
            keys: unrecognized,
            continue: true
          });
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
  });
  $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = getEnumValues(def.entries);
    const valuesSet = new Set(values);
    inst._zod.values = valuesSet;
    defineLazyInternal(inst, "pattern", (zod) => {
      const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
      return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
    });
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (valuesSet.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values,
        input,
        inst
      });
      return payload;
    };
  });
  $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    globalConfig.memoizer?.guard(inst);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        throw new $ZodEncodeError(inst.constructor.name);
      }
      const _out = def.transform(payload.value, payload);
      if (ctx.async) {
        const output = _out instanceof Promise ? _out : Promise.resolve(_out);
        return output.then((output) => {
          payload.value = output;
          return payload;
        });
      }
      if (_out instanceof Promise) {
        throw new $ZodAsyncError;
      }
      payload.value = _out;
      return payload;
    };
  });
  $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
    inst._zod.optout = "optional";
    defineLazyInternal(inst, "values", (zod) => {
      const values = zod.def.innerType._zod.values;
      return values ? new Set([...values, undefined]) : undefined;
    });
    defineLazyInternal(inst, "pattern", (zod) => {
      const pattern = zod.def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === undefined) {
        if (def.innerType._zod.optin !== "defaulted")
          return payload;
        const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
        if (result instanceof Promise)
          return result.then((result) => handleOptionalResult(payload, result));
        return handleOptionalResult(payload, result);
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
    inst._zod.parse = (payload, ctx) => {
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
    defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
    defineLazyInternal(inst, "pattern", (zod) => {
      const pattern = zod.def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
    });
    defineLazyInternal(inst, "values", (zod) => {
      return zod.def.innerType._zod.values ? new Set([...zod.def.innerType._zod.values, null]) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === null)
        return payload;
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "defaulted";
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === undefined) {
        payload.value = def.defaultValue;
        return payload;
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result) => handleDefaultResult(result, def));
      }
      return handleDefaultResult(result, def);
    };
  });
  $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "defaulted";
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === undefined) {
        payload.value = def.defaultValue;
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "values", (zod) => {
      const v = zod.def.innerType._zod.values;
      return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result) => handleNonOptionalResult(result, inst));
      }
      return handleNonOptionalResult(result, inst);
    };
  });
  $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
    defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
      if (result instanceof Promise) {
        return result.then((result) => handleCatchResult(payload, result, def, ctx));
      }
      return handleCatchResult(payload, result, def, ctx);
    };
  });
  $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
    defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
    defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
    defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        const right = def.out._zod.run(payload, ctx);
        if (right instanceof Promise) {
          return right.then((right) => handlePipeResult(right, def.in, ctx));
        }
        return handlePipeResult(right, def.in, ctx);
      }
      const left = def.in._zod.run(payload, ctx);
      if (left instanceof Promise) {
        return left.then((left) => handlePipeResult(left, def.out, ctx));
      }
      return handlePipeResult(left, def.out, ctx);
    };
  });
  $ZodPreprocess = /* @__PURE__ */ $constructor("$ZodPreprocess", (inst, def) => {
    $ZodPipe.init(inst, def);
  });
  $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
    defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
    defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
    defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then(handleReadonlyResult);
      }
      return handleReadonlyResult(result);
    };
  });
  $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
    $ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
      return payload;
    };
    inst._zod.check = (payload) => {
      const input = payload.value;
      const r = def.fn(input);
      if (r instanceof Promise) {
        return r.then((r) => handleRefineResult(r, payload, input, inst));
      }
      handleRefineResult(r, payload, input, inst);
      return;
    };
  });
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/memoizer.js
function isRef(value) {
  return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
  return issues.map((iss) => iss.path ? { ...iss, path: iss.path.slice() } : { ...iss });
}
function isRecursive(inst, stack, resolve) {
  const cached = recursive.get(inst);
  if (cached !== undefined)
    return cached ? PROVEN : NONE;
  if (stack.has(inst))
    return PROVEN;
  stack.add(inst);
  let result = NONE;
  const check = (child) => {
    if (result !== PROVEN && child?._zod) {
      const answer = isRecursive(child, stack, resolve);
      if (answer > result)
        result = answer;
    }
  };
  const shape = (sh, spread) => {
    let answer = NONE;
    for (const key of Reflect.ownKeys(sh)) {
      const desc = Object.getOwnPropertyDescriptor(sh, key);
      if (spread && !desc.enumerable)
        continue;
      const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
      if (child > answer)
        answer = child;
    }
    return answer;
  };
  const merge = (answer) => {
    if (answer > result)
      result = answer;
  };
  const def = inst._zod.def;
  const kind = def.type;
  switch (kind) {
    case "object": {
      const raw = rawShape(def);
      merge(raw ? shape(raw, true) : ASSUMED);
      check(def.catchall);
      break;
    }
    case "array":
      check(def.element);
      break;
    case "tuple":
      for (const el of def.items)
        check(el);
      check(def.rest);
      break;
    case "record":
    case "map":
      check(def.keyType);
      check(def.valueType);
      break;
    case "set":
      check(def.valueType);
      break;
    case "union":
      for (const el of def.options)
        check(el);
      break;
    case "intersection":
      check(def.left);
      check(def.right);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
    case "promise":
    case "success":
      check(def.innerType);
      break;
    case "pipe":
      check(def.in);
      check(def.out);
      break;
    case "function":
      check(def.input);
      check(def.output);
      break;
    case "lazy": {
      const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : undefined);
      merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
      break;
    }
    case "template_literal":
    case "string":
    case "number":
    case "int":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
    case "null":
    case "void":
    case "never":
    case "any":
    case "unknown":
    case "date":
    case "nan":
    case "enum":
    case "literal":
    case "file":
    case "transform":
    case "custom":
      break;
    default: {
      for (const key in def) {
        const desc = Object.getOwnPropertyDescriptor(def, key);
        if (!desc || desc.get)
          continue;
        const value = desc.value;
        if (!value || typeof value !== "object")
          continue;
        if (value._zod)
          check(value);
        else if (Array.isArray(value))
          for (const el of value)
            check(el);
      }
    }
  }
  stack.delete(inst);
  return settle(inst, result);
}
function settle(inst, answer) {
  if (answer !== ASSUMED)
    recursive.set(inst, answer === PROVEN);
  return answer;
}
function bucketFor(state, inst) {
  let bucket = state.buckets.get(inst);
  if (!bucket) {
    bucket = new WeakMap;
    state.buckets.set(inst, bucket);
  }
  return bucket;
}
function memoizer() {
  return memo;
}
function isBackEdge(ctx, value) {
  const backEdges = ctx[STATE]?.backEdges;
  return backEdges !== undefined && isRef(value) && backEdges.has(value);
}
var $ZodCyclicError, STATE = "~memo", NO_ISSUES, recursive, NONE = 0, ASSUMED = 1, PROVEN = 2, handoff, open2, memo;
var init_memoizer = __esm(() => {
  init_util();
  $ZodCyclicError = class $ZodCyclicError extends Error {
    constructor() {
      super(`Cannot parse a reference cycle that closes through a transform`);
      this.name = "ZodCyclicError";
    }
  };
  NO_ISSUES = [];
  recursive = /* @__PURE__ */ new WeakMap;
  open2 = [];
  memo = {
    alloc(_inst, payload, empty) {
      const bucket = handoff;
      if (!bucket)
        return empty;
      handoff = undefined;
      const entry = { value: empty, issues: null };
      bucket.set(payload.value, entry);
      open2.push(entry);
      return empty;
    },
    guard(inst) {
      var _a;
      (_a = inst._zod).deferred ?? (_a.deferred = []);
      inst._zod.deferred.push(() => {
        const base = inst._zod.parse;
        const wrapped = (payload, ctx) => {
          if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value))
            throw new $ZodCyclicError;
          return base(payload, ctx);
        };
        inst._zod.parse = wrapped;
        if (inst._zod.run === base)
          inst._zod.run = wrapped;
      });
    },
    attach(inst) {
      var _a;
      let isRecursiveInst;
      let rechecked = false;
      let lastCtx;
      let lastBucket;
      (_a = inst._zod).deferred ?? (_a.deferred = []);
      inst._zod.deferred.push(() => {
        const base = inst._zod.parse;
        const wrapped = (payload, ctx) => {
          if (isRecursiveInst === undefined) {
            const walked = isRecursive(inst, new Set, false);
            if (walked === NONE) {
              inst._zod.parse = base;
              if (inst._zod.run === wrapped)
                inst._zod.run = base;
              return base(payload, ctx);
            }
            if (walked === PROVEN || rechecked)
              isRecursiveInst = true;
            else
              rechecked = true;
          }
          const input = payload.value;
          if (!isRef(input))
            return base(payload, ctx);
          let state = ctx[STATE];
          if (!state) {
            state = { buckets: new WeakMap, backEdges: undefined };
            ctx[STATE] = state;
          }
          let bucket;
          if (lastCtx === ctx) {
            bucket = lastBucket;
          } else {
            bucket = bucketFor(state, inst);
            lastCtx = ctx;
            lastBucket = bucket;
          }
          const hit = bucket.get(input);
          if (hit) {
            payload.value = hit.value;
            if (hit.issues) {
              if (hit.issues.length)
                payload.issues.push(...cloneIssues(hit.issues));
            } else {
              payload.memo = true;
              state.backEdges ?? (state.backEdges = new WeakSet);
              state.backEdges.add(hit.value);
            }
            return payload;
          }
          handoff = bucket;
          const depth = open2.length;
          const result = base(payload, ctx);
          handoff = undefined;
          const entry = open2.length > depth ? open2.pop() : undefined;
          if (result instanceof Promise) {
            return result.then((r) => {
              if (entry)
                entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
              return r;
            });
          }
          if (entry)
            entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
          return result;
        };
        inst._zod.parse = wrapped;
        if (inst._zod.run === base)
          inst._zod.run = wrapped;
      });
    }
  };
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/locales/en.js
function en_default() {
  return {
    localeError: error()
  };
}
var error = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    currency_code: "currency code",
    credit_card: "credit card number",
    iban: "IBAN",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  function getTypeName(type, input) {
    if (type === "number" && typeof input === "number" && !Number.isFinite(input)) {
      return String(input);
    }
    return TypeDictionary[type] ?? type;
  }
  return (issue) => {
    switch (issue.code) {
      case "invalid_type": {
        const expected = getTypeName(issue.expected);
        const receivedType = parsedType(issue.input);
        const received = getTypeName(receivedType, issue.input);
        return `Invalid input: expected ${expected}, received ${received}`;
      }
      case "invalid_value":
        if (issue.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
      case "too_big": {
        const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
        const sizing = getSizing(issue.origin);
        if (sizing)
          return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
        const sizing = getSizing(issue.origin);
        if (sizing) {
          return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue.origin}`;
      case "invalid_union":
        if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) {
          const opts = issue.options.map((o) => `'${o}'`).join(" | ");
          return `Invalid discriminator value. Expected ${opts}`;
        }
        if (issue.inclusive === false) {
          return "Invalid input: more than one option matched";
        }
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
var init_en = __esm(() => {
  init_util();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/locales/index.js
var init_locales = () => {};

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/registries.js
class $ZodRegistry {
  constructor() {
    this._map = new WeakMap;
    this._idmap = new Map;
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = new WeakMap;
    this._idmap = new Map;
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : undefined;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry;
}
var _a2, globalRegistry;
var init_registries = __esm(() => {
  (_a2 = globalThis).__zod_globalRegistry ?? (_a2.__zod_globalRegistry = registry());
  globalRegistry = globalThis.__zod_globalRegistry;
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/compile.js
var INVALID, FALLBACK_FLAG, WHEN_DEFAULTED_CHECKS, PATTERN_IS_COMPLETE;
var init_compile = __esm(() => {
  INVALID = Symbol.for("zod.compile.invalid");
  FALLBACK_FLAG = Symbol.for("zod.compile.fallback");
  WHEN_DEFAULTED_CHECKS = new Set([
    "max_size",
    "min_size",
    "size_equals",
    "max_length",
    "min_length",
    "length_equals"
  ]);
  PATTERN_IS_COMPLETE = new Set([
    "cidrv4",
    "cuid",
    "cuid2",
    "date",
    "datetime",
    "duration",
    "e164",
    "email",
    "emoji",
    "ends_with",
    "guid",
    "includes",
    "ipv4",
    "ksuid",
    "lowercase",
    "mac",
    "nanoid",
    "regex",
    "starts_with",
    "time",
    "ulid",
    "uppercase",
    "uuid",
    "xid"
  ]);
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
  if (def.checks)
    def.checks = [...def.checks];
  return def;
}
function _string(Class, params) {
  return new Class(snapshotChecks({ type: "string", ...normalizeParams(params) }));
}
function _email(Class, params) {
  return new Class({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _guid(Class, params) {
  return new Class({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuid(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuidv4(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
function _uuidv6(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
function _uuidv7(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _emoji2(Class, params) {
  return new Class({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _nanoid(Class, params) {
  return new Class({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid(Class, params) {
  return new Class({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid2(Class, params) {
  return new Class({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ulid(Class, params) {
  return new Class({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _xid(Class, params) {
  return new Class({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ksuid(Class, params) {
  return new Class({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv4(Class, params) {
  return new Class({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv6(Class, params) {
  return new Class({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv4(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv6(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64(Class, params) {
  return new Class({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64url(Class, params) {
  return new Class({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _e164(Class, params) {
  return new Class({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _jwt(Class, params) {
  return new Class({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _number(Class, params) {
  return new Class(snapshotChecks({ type: "number", checks: [], ...normalizeParams(params) }));
}
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
function _boolean(Class, params) {
  return new Class({
    type: "boolean",
    ...normalizeParams(params)
  });
}
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
function _normalize(form) {
  return _overwrite((input) => input.normalize(form));
}
function _trim() {
  return _overwrite((input) => input.trim());
}
function _toLowerCase() {
  return _overwrite((input) => input.toLowerCase());
}
function _toUpperCase() {
  return _overwrite((input) => input.toUpperCase());
}
function _slugify() {
  return _overwrite((input) => slugify(input));
}
function _array(Class, element, params) {
  return new Class({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
function _superRefine(fn, params) {
  const ch = _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
var init_api = __esm(() => {
  init_checks();
  init_util();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
  for (const source of sources) {
    for (const key of Reflect.ownKeys(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, key)) {
        assignProp(target, key, source[key]);
      }
    }
  }
  return target;
}
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {}),
    io: params?.io ?? "output",
    counter: 0,
    seen: new Map,
    sharedDefsExtractedFor: undefined,
    sharedEmitDoneFor: undefined,
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    intersections: [],
    deferred: [],
    external: params?.external ?? undefined
  };
}
function handleUnrepresentable(schema, ctx, json, params, message) {
  const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({ zodSchema: schema, path: params.path, message }) : ctx.unrepresentable;
  if (result === "any")
    return false;
  if (result === undefined || result === "throw")
    throw new Error(message);
  Object.assign(json, result);
  return true;
}
function processSchema(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
  ctx.seen.set(schema, result);
  ctx.sharedDefsExtractedFor = undefined;
  ctx.sharedEmitDoneFor = undefined;
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      processSchema(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    assignProps(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a = result.schema).default ?? (_a.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function encodeJSONPointerSegment(segment) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external)
    return;
  const idToSchema = new Map;
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id) => id);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}` };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    if (entry[1] === root && !entry[1].schema.id) {
      return { ref: uriPrefix };
    }
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + encodeJSONPointerSegment(defId) };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema = seen.schema;
    for (const key in schema) {
      delete schema[key];
    }
    schema.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error("Cycle detected: " + `#/${seen.cycle?.join("/")}/<root>` + '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
      }
    }
  }
  if (ctx.external)
    ctx.sharedDefsExtractedFor = ctx.external;
}
function compactTypeUnion(schema) {
  const options = schema.anyOf;
  if (!Array.isArray(options) || options.length === 0 || schema.type !== undefined)
    return;
  const types = [];
  for (const option of options) {
    if (!option || typeof option !== "object")
      return;
    compactTypeUnion(option);
    const keys = Object.keys(option);
    if (keys.length !== 1 || keys[0] !== "type")
      return;
    const type = option.type;
    for (const member of Array.isArray(type) ? type : [type]) {
      if (typeof member !== "string")
        return;
      if (!types.includes(member))
        types.push(member);
    }
  }
  delete schema.anyOf;
  schema.type = types.length === 1 ? types[0] : types;
}
function undeclaredConstraint(member) {
  const extra = member.additionalProperties;
  if (extra === undefined || extra === false || typeof extra !== "object" || extra === null)
    return null;
  return Object.keys(extra).length ? extra : null;
}
function foldObjects(members) {
  const objects = [];
  for (const member of members) {
    if (typeof member !== "object" || member.type !== "object")
      return null;
    for (const key in member) {
      if (!FOLDABLE_KEYS.has(key))
        return null;
    }
    objects.push(member);
  }
  const properties = {};
  const required = new Set;
  for (const object of objects) {
    for (const key in object.properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key))
        continue;
      const parts = [];
      for (const other of objects) {
        const part = other.properties?.[key] ?? undeclaredConstraint(other);
        if (part === null || part === undefined)
          continue;
        if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part)))
          parts.push(part);
      }
      const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
      assignProp(properties, key, merged);
    }
    for (const key of object.required ?? [])
      required.add(key);
  }
  const folded = { type: "object", properties };
  if (required.size)
    folded.required = [...required];
  if (objects.every((object) => object.additionalProperties === false)) {
    folded.additionalProperties = false;
  } else {
    const constraints = [];
    for (const object of objects) {
      const constraint = undeclaredConstraint(object);
      if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint)))
        constraints.push(constraint);
    }
    if (constraints.length === 1)
      folded.additionalProperties = constraints[0];
    else if (constraints.length > 1)
      folded.additionalProperties = { allOf: constraints };
  }
  return folded;
}
function foldIntersection(json) {
  const allOf = json.allOf;
  if (!Array.isArray(allOf) || allOf.length < 2)
    return;
  for (const key of FOLDABLE_KEYS)
    if (key in json)
      return;
  const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
  let folded = null;
  if (!unions.length) {
    folded = foldObjects(allOf);
  } else {
    const union = unions[0];
    const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
    if (Object.keys(union).length !== 1)
      return;
    const rest = allOf.filter((m) => m !== union);
    const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
    if (branches.some((b) => !b))
      return;
    folded = { [keyword]: branches };
  }
  if (!folded)
    return;
  delete json.allOf;
  assignProps(json, folded);
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema = seen.def ?? seen.schema;
    const _cached = { ...schema };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema.allOf = schema.allOf ?? [];
        schema.allOf.push(refSchema);
      } else {
        assignProps(schema, refSchema);
      }
      assignProps(schema, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema,
      path: seen.path ?? []
    });
  };
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of [...ctx.seen.entries()].reverse()) {
      flattenRef(entry[0]);
    }
    if (ctx.target !== "openapi-3.0") {
      for (const entry of ctx.seen.entries()) {
        compactTypeUnion(entry[1].def ?? entry[1].schema);
      }
    }
    for (const rewrite of ctx.deferred)
      rewrite();
    if (ctx.intersections.length) {
      const carriers = new Map;
      for (const seen of ctx.seen.values()) {
        for (const json of [seen.schema, seen.def]) {
          const allOf = json?.allOf;
          if (!Array.isArray(allOf))
            continue;
          const existing = carriers.get(allOf);
          if (existing)
            existing.push(json);
          else
            carriers.set(allOf, [json]);
        }
      }
      for (const allOf of ctx.intersections) {
        for (const json of carriers.get(allOf) ?? [])
          foldIntersection(json);
      }
    }
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") {}
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== undefined && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.def && seen.defId) {
        if (seen.def.id === seen.defId)
          delete seen.def.id;
        assignProp(defs, seen.defId, seen.def);
      }
    }
  }
  if (ctx.external)
    ctx.sharedEmitDoneFor = ctx.external;
  if (ctx.external) {} else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: new Set };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
var FOLDABLE_KEYS, UNION_KEYS, createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
}, createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
var init_to_json_schema = __esm(() => {
  init_registries();
  init_util();
  FOLDABLE_KEYS = new Set(["type", "properties", "required", "additionalProperties"]);
  UNION_KEYS = ["oneOf", "anyOf"];
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/json-schema-processors.js
function aggregateChecks(schema) {
  const agg = {};
  const def = schema._zod.def;
  const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
  for (const ch of list)
    contributors[ch._zod.def.check]?.(agg, ch._zod.def);
  const bag = schema._zod.bag;
  if (bag.minimum !== undefined)
    narrowMin(agg, "minimum", bag.minimum);
  if (bag.exclusiveMinimum !== undefined)
    narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
  if (bag.maximum !== undefined)
    narrowMax(agg, "maximum", bag.maximum);
  if (bag.exclusiveMaximum !== undefined)
    narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
  if (bag.multipleOf !== undefined)
    addDivisor(agg, bag.multipleOf);
  if (bag.format !== undefined) {
    agg.format ?? (agg.format = bag.format);
    if (bag.format.includes("int"))
      agg.isInt = true;
  }
  if (bag.mime)
    intersectMime(agg, bag.mime);
  for (const pattern of bag.patterns ?? [])
    addPattern(agg, pattern);
  return agg;
}
function inputOptin(schema) {
  const def = schema._zod.def;
  if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) {
    return inputOptin(def.out);
  }
  if (def.type === "catch") {
    return inputOptin(def.innerType);
  }
  return schema._zod.optin;
}
function stringifyKeyNames(bySchema, json, visited) {
  if (json.$ref) {
    if (visited.has(json))
      return json;
    visited.add(json);
    const def = bySchema.get(json)?.def;
    if (!def)
      return json;
    const inlined = stringifyKeyNames(bySchema, def, visited);
    return inlined === def ? json : inlined;
  }
  for (const keyword of ["anyOf", "oneOf"]) {
    const branches = json[keyword];
    if (!Array.isArray(branches))
      continue;
    const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
    if (mapped.some((branch, i) => branch !== branches[i]))
      json = { ...json, [keyword]: mapped };
  }
  const types = Array.isArray(json.type) ? json.type : [json.type];
  const numericType = !types.includes("string") && types.some((t) => t === "number" || t === "integer");
  const values = json.enum ?? (json.const !== undefined ? [json.const] : undefined);
  if (!numericType && !values?.some((v) => typeof v === "number"))
    return json;
  const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
  if (rest.enum)
    rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
  else if (typeof rest.const === "number")
    rest.const = String(rest.const);
  if (!numericType)
    return rest;
  rest.type = "string";
  if (!values)
    rest.pattern = (types.includes("number") ? number : integer).source;
  return rest;
}
function rewriteKeyNames(ctx) {
  const bySchema = new Map;
  for (const entry of ctx.seen.values()) {
    if (entry.def && !bySchema.has(entry.schema))
      bySchema.set(entry.schema, entry);
  }
  const rewrites = new Map;
  for (const record of pendingRecords.get(ctx) ?? []) {
    const seen = ctx.seen.get(record);
    const names = (seen?.def ?? seen?.schema)?.propertyNames;
    if (!names || names === true || rewrites.has(names))
      continue;
    const rewritten = stringifyKeyNames(bySchema, names, new Set);
    if (rewritten !== names)
      rewrites.set(names, rewritten);
  }
  if (!rewrites.size)
    return;
  for (const entry of ctx.seen.values()) {
    for (const carrier of [entry.schema, entry.def]) {
      const rewritten = carrier && rewrites.get(carrier.propertyNames);
      if (rewritten)
        carrier.propertyNames = rewritten;
    }
  }
}
function serializeDefaultValue(value, schema, ctx, json, params) {
  let unrepresentable = false;
  const serialized = JSON.stringify(value, (_, val) => {
    if (typeof val !== "bigint")
      return val;
    unrepresentable = true;
    return null;
  });
  if (!unrepresentable)
    return JSON.parse(serialized);
  handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
  return UNREPRESENTABLE_DEFAULT;
}
var narrowMin = (agg, key, value) => {
  if (agg[key] === undefined || value > agg[key])
    agg[key] = value;
}, narrowMax = (agg, key, value) => {
  if (agg[key] === undefined || value < agg[key])
    agg[key] = value;
}, narrowBoth = (agg, value) => {
  narrowMin(agg, "minimum", value);
  narrowMax(agg, "maximum", value);
}, addDivisor = (agg, value) => {
  agg.multipleOf ?? (agg.multipleOf = []);
  if (!agg.multipleOf.includes(value))
    agg.multipleOf.push(value);
}, addPattern = (agg, pattern) => {
  agg.patterns ?? (agg.patterns = new Set);
  agg.patterns.add(pattern);
}, intersectMime = (agg, mime) => {
  agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
}, setFormat = (agg, format) => {
  agg.format = format;
  if (format.includes("int"))
    agg.isInt = true;
}, minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum), maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum), formatContributor = (ranges) => (agg, def) => {
  setFormat(agg, def.format);
  const [minimum, maximum] = ranges[def.format];
  narrowMin(agg, "minimum", minimum);
  narrowMax(agg, "maximum", maximum);
}, contributors, formatMap, exactPatterns, exactPattern = (p) => exactPatterns.get(p) ?? p, stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time" || laxFormat) {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const patternList = [...patterns].map(exactPattern);
    if (patternList.length === 1)
      json.pattern = patternList[0].source;
    else if (patternList.length > 1) {
      json.allOf = [
        ...patternList.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
}, numberProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
  json.type = isInt ? "integer" : "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json.minimum = minimum;
  }
  if (exMax) {
    if (legacy) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (multipleOf) {
    const divisors = new Set;
    for (const divisor of multipleOf) {
      if (Number.isFinite(divisor) && divisor !== 0)
        divisors.add(Math.abs(divisor));
      else
        handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
    }
    const [first, ...rest] = divisors;
    if (first !== undefined)
      json.multipleOf = first;
    if (rest.length)
      json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
  }
}, booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
}, neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
}, unknownProcessor = (_schema, _ctx, _json, _params) => {}, enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.length === 0) {
    json.not = {};
    return;
  }
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
}, customProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
}, transformProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
}, arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = processSchema(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
}, objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const shape = def.shape;
  const symbolKeys = Object.getOwnPropertySymbols(shape);
  if (symbolKeys.length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) {
    return;
  }
  json.type = "object";
  json.properties = {};
  for (const key in shape) {
    assignProp(json.properties, key, processSchema(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    }));
  }
  const requiredKeys = [];
  for (const key of Object.keys(shape)) {
    const field = def.shape[key];
    if (ctx.io === "input" ? inputOptin(field) === undefined : field._zod.optout === undefined) {
      requiredKeys.push(key);
    }
  }
  if (requiredKeys.length > 0) {
    json.required = requiredKeys;
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = processSchema(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
}, unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => processSchema(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
}, intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = processSchema(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = processSchema(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => ("allOf" in val) && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
  ctx.intersections.push(allOf);
}, pendingRecords, recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const patterns = aggregateChecks(keyType).patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = processSchema(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns) {
      assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = processSchema(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
      let pending = pendingRecords.get(ctx);
      if (!pending) {
        pending = [];
        pendingRecords.set(ctx, pending);
        ctx.deferred.push(() => rewriteKeyNames(ctx));
      }
      pending.push(schema);
    }
    json.additionalProperties = processSchema(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== undefined;
  if (keyValues && !def.partial && !omittableOnInput) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues.map(String);
    }
  }
}, nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
}, nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
}, UNREPRESENTABLE_DEFAULT, defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json.default = value;
}, prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io !== "input")
    return;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json._prefault = value;
}, catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(undefined);
  } catch {
    handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
    return;
  }
  json.default = catchValue;
}, pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  processSchema(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
}, readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
}, optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var init_json_schema_processors = __esm(() => {
  init_regexes();
  init_schemas();
  init_to_json_schema();
  init_util();
  contributors = {
    greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
    less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
    multiple_of: (agg, def) => addDivisor(agg, def.value),
    number_format: formatContributor(NUMBER_FORMAT_RANGES),
    bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
    min_length: minContributor,
    max_length: maxContributor,
    length_equals: (agg, def) => narrowBoth(agg, def.length),
    min_size: minContributor,
    max_size: maxContributor,
    size_equals: (agg, def) => narrowBoth(agg, def.size),
    string_format: (agg, def) => {
      setFormat(agg, def.format);
      if (def.pattern)
        addPattern(agg, def.pattern);
      if (def.format === "base64" || def.format === "base64url")
        agg.contentEncoding = def.format;
      if (def.local || def.precision === -1)
        agg.laxFormat = true;
    },
    mime_type: (agg, def) => intersectMime(agg, def.mime)
  };
  formatMap = {
    guid: "uuid",
    url: "uri",
    datetime: "date-time",
    json_string: "json-string",
    regex: ""
  };
  exactPatterns = new Map([
    [base64Charset, base64],
    [base64urlCharset, base64url]
  ]);
  pendingRecords = new WeakMap;
  UNREPRESENTABLE_DEFAULT = Symbol();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/json-schema.js
var init_json_schema = () => {};

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/core/index.js
var init_core2 = __esm(() => {
  init_util();
  init_regexes();
  init_locales();
  init_json_schema();
  init_core();
  init_parse2();
  init_errors();
  init_schemas();
  init_memoizer();
  init_checks();
  init_versions();
  init_registries();
  init_compile();
  init_api();
  init_to_json_schema();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/checks.js
var init_checks2 = __esm(() => {
  init_core2();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/errors.js
function _lazyMethod(proto, key, make) {
  Object.defineProperty(proto, key, {
    configurable: true,
    enumerable: false,
    get() {
      const value = make(this);
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
      return value;
    },
    set(value) {
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
    }
  });
}
var _installedErrorProtos, initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  const proto = Object.getPrototypeOf(inst);
  if (_installedErrorProtos.has(proto))
    return;
  _installedErrorProtos.add(proto);
  _lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
  _lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
  _lazyMethod(proto, "addIssue", (self) => (issue) => {
    self.issues.push(issue);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  _lazyMethod(proto, "addIssues", (self) => (issues) => {
    self.issues.push(...issues);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  Object.defineProperty(proto, "isEmpty", {
    configurable: true,
    enumerable: false,
    get() {
      return this.issues.length === 0;
    }
  });
}, ZodRealError;
var init_errors2 = __esm(() => {
  init_core2();
  init_core2();
  init_util();
  _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
  ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, undefined, {
    Parent: Error
  });
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/parse.js
var parse3, parseAsync, safeParse, safeParseAsync, encode, decode, encodeAsync, decodeAsync, safeEncode, safeDecode, safeEncodeAsync, safeDecodeAsync;
var init_parse3 = __esm(() => {
  init_core2();
  init_errors2();
  init_core2();
  parse3 = /* @__PURE__ */ _parse(ZodRealError);
  parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
  safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
  safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
  encode = /* @__PURE__ */ _encode(ZodRealError);
  decode = /* @__PURE__ */ _decode(ZodRealError);
  encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
  decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
  safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
  safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
  safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
  safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
  if (!globalConfig.localeError)
    config(en_default());
}
function _ensureDefaultMemoizer() {
  if (!globalConfig.memoizer)
    config({ memoizer: memoizer() });
}
function string2(params) {
  return _string(ZodString, params);
}
function number2(params) {
  return _number(ZodNumber, params);
}
function int(params) {
  return _int(ZodNumberFormat, params);
}
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
function unknown() {
  return _unknown(ZodUnknown);
}
function never(params) {
  return _never(ZodNever, params);
}
function array(element, params) {
  return _array(ZodArray, element, params);
}
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject(def);
}
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodRecord({
      type: "record",
      keyType: string2(),
      valueType: keyType,
      ...normalizeParams(valueType)
    });
  }
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
  });
}
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
  });
}
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return _superRefine(fn, params);
}
function preprocess(fn, schema) {
  return new ZodPreprocess({
    type: "pipe",
    in: transform(fn),
    out: schema
  });
}
var ZodType, _ZodString, ZodString, ZodStringFormat, ZodISODateTime, ZodISODate, ZodISOTime, ZodISODuration, ZodEmail, ZodGUID, ZodUUID, ZodURL, ZodEmoji, ZodNanoID, ZodCUID, ZodCUID2, ZodULID, ZodXID, ZodKSUID, ZodIPv4, ZodIPv6, ZodCIDRv4, ZodCIDRv6, ZodBase64, ZodBase64URL, ZodE164, ZodJWT, ZodNumber, ZodNumberFormat, ZodBoolean, ZodUnknown, ZodNever, ZodArray, ZodObject, ZodUnion, ZodIntersection, ZodRecord, ZodEnum, ZodTransform, ZodOptional, ZodExactOptional, ZodNullable, ZodDefault, ZodPrefault, ZodNonOptional, ZodCatch, ZodPipe, ZodPreprocess, ZodReadonly, ZodCustom;
var init_schemas2 = __esm(() => {
  init_core2();
  init_core2();
  init_json_schema_processors();
  init_to_json_schema();
  init_en();
  init_checks2();
  init_parse3();
  ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
    _ensureDefaultLocale();
    $ZodType.init(inst, def);
    inst.def = def;
    inst.type = def.type;
    return inst;
  }, {
    check(...chks) {
      const def = this.def;
      return this.clone(mergeDefs(def, {
        checks: [
          ...def.checks ?? [],
          ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }), { parent: true });
    },
    with(...chks) {
      return this.check(...chks);
    },
    clone(def, params) {
      return clone(this, def, params);
    },
    brand() {
      return this;
    },
    register(reg, meta) {
      reg.add(this, meta);
      return this;
    },
    refine(check, params) {
      return this.check(refine(check, params));
    },
    superRefine(refinement, params) {
      return this.check(superRefine(refinement, params));
    },
    overwrite(fn) {
      return this.check(_overwrite(fn));
    },
    optional() {
      return optional(this);
    },
    exactOptional() {
      return exactOptional(this);
    },
    nullable() {
      return nullable(this);
    },
    nullish() {
      return optional(nullable(this));
    },
    nonoptional(params) {
      return nonoptional(this, params);
    },
    array() {
      return array(this);
    },
    or(arg) {
      return union([this, arg]);
    },
    and(arg) {
      return intersection(this, arg);
    },
    transform(tx) {
      return pipe(this, transform(tx));
    },
    default(d) {
      return _default(this, d);
    },
    prefault(d) {
      return prefault(this, d);
    },
    catch(params) {
      return _catch(this, params);
    },
    pipe(target) {
      return pipe(this, target);
    },
    readonly() {
      return readonly(this);
    },
    describe(description) {
      const cl = this.clone();
      globalRegistry.add(cl, { description });
      return cl;
    },
    meta(...args) {
      if (args.length === 0)
        return globalRegistry.get(this);
      const cl = this.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    },
    isOptional() {
      return this.safeParse(undefined).success;
    },
    isNullable() {
      return this.safeParse(null).success;
    },
    apply(fn, ...args) {
      return args.length === 0 ? fn(this) : fn(this, ...args);
    },
    get "~standard"() {
      return hide(this, "~standard", {
        ...standardProps(this),
        jsonSchema: {
          input: createStandardJSONSchemaMethod(this, "input"),
          output: createStandardJSONSchemaMethod(this, "output")
        }
      });
    },
    set "~standard"(value) {
      own(this, "~standard", value);
    },
    parse: function _parse(data, params) {
      return parse3(this, data, params, { callee: _parse });
    },
    parseAsync: async function _parseAsync(data, params) {
      return await parseAsync(this, data, params, { callee: _parseAsync });
    },
    safeParse(data, params) {
      return safeParse(this, data, params);
    },
    async safeParseAsync(data, params) {
      return safeParseAsync(this, data, params);
    },
    get spa() {
      return this?.safeParseAsync;
    },
    set spa(value) {
      own(this, "spa", value);
    },
    validate(data, params) {
      return validate2(this, data, params);
    },
    validateAsync(data, params) {
      return validateAsync(this, data, params);
    },
    encode: function _encode(data, params) {
      return encode(this, data, params, { callee: _encode });
    },
    decode: function _decode(data, params) {
      return decode(this, data, params, { callee: _decode });
    },
    encodeAsync: async function _encodeAsync(data, params) {
      return await encodeAsync(this, data, params, { callee: _encodeAsync });
    },
    decodeAsync: async function _decodeAsync(data, params) {
      return await decodeAsync(this, data, params, { callee: _decodeAsync });
    },
    safeEncode(data, params) {
      return safeEncode(this, data, params);
    },
    safeDecode(data, params) {
      return safeDecode(this, data, params);
    },
    async safeEncodeAsync(data, params) {
      return safeEncodeAsync(this, data, params);
    },
    async safeDecodeAsync(data, params) {
      return safeDecodeAsync(this, data, params);
    },
    toJSONSchema(params) {
      return createToJSONSchemaMethod(this, {})(params);
    },
    get description() {
      return globalRegistry.get(this)?.description;
    },
    get _def() {
      return this._zod.def;
    }
  });
  _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
  }, /* @__PURE__ */ derived({
    format: (inst) => aggregateChecks(inst).format ?? null,
    minLength: (inst) => aggregateChecks(inst).minimum ?? null,
    maxLength: (inst) => aggregateChecks(inst).maximum ?? null
  }, {
    regex(...args) {
      return this.check(_regex(...args));
    },
    includes(...args) {
      return this.check(_includes(...args));
    },
    startsWith(...args) {
      return this.check(_startsWith(...args));
    },
    endsWith(...args) {
      return this.check(_endsWith(...args));
    },
    min(...args) {
      return this.check(_minLength(...args));
    },
    max(...args) {
      return this.check(_maxLength(...args));
    },
    length(...args) {
      return this.check(_length(...args));
    },
    nonempty(...args) {
      return this.check(_minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(_lowercase(params));
    },
    uppercase(params) {
      return this.check(_uppercase(params));
    },
    trim() {
      return this.check(_trim());
    },
    normalize(...args) {
      return this.check(_normalize(...args));
    },
    toLowerCase() {
      return this.check(_toLowerCase());
    },
    toUpperCase() {
      return this.check(_toUpperCase());
    },
    slugify() {
      return this.check(_slugify());
    }
  }));
  ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    _ZodString.init(inst, def);
  }, {
    email(params) {
      return this.check(_email(ZodEmail, params));
    },
    url(params) {
      return this.check(_url(ZodURL, params));
    },
    jwt(params) {
      return this.check(_jwt(ZodJWT, params));
    },
    emoji(params) {
      return this.check(_emoji2(ZodEmoji, params));
    },
    guid(params) {
      return this.check(_guid(ZodGUID, params));
    },
    uuid(params) {
      return this.check(_uuid(ZodUUID, params));
    },
    uuidv4(params) {
      return this.check(_uuidv4(ZodUUID, params));
    },
    uuidv6(params) {
      return this.check(_uuidv6(ZodUUID, params));
    },
    uuidv7(params) {
      return this.check(_uuidv7(ZodUUID, params));
    },
    nanoid(params) {
      return this.check(_nanoid(ZodNanoID, params));
    },
    cuid(params) {
      return this.check(_cuid(ZodCUID, params));
    },
    cuid2(params) {
      return this.check(_cuid2(ZodCUID2, params));
    },
    ulid(params) {
      return this.check(_ulid(ZodULID, params));
    },
    base64(params) {
      return this.check(_base64(ZodBase64, params));
    },
    base64url(params) {
      return this.check(_base64url(ZodBase64URL, params));
    },
    xid(params) {
      return this.check(_xid(ZodXID, params));
    },
    ksuid(params) {
      return this.check(_ksuid(ZodKSUID, params));
    },
    ipv4(params) {
      return this.check(_ipv4(ZodIPv4, params));
    },
    ipv6(params) {
      return this.check(_ipv6(ZodIPv6, params));
    },
    cidrv4(params) {
      return this.check(_cidrv4(ZodCIDRv4, params));
    },
    cidrv6(params) {
      return this.check(_cidrv6(ZodCIDRv6, params));
    },
    e164(params) {
      return this.check(_e164(ZodE164, params));
    },
    datetime(params) {
      return this.check(_isoDateTime(ZodISODateTime, params));
    },
    date(params) {
      return this.check(_isoDate(ZodISODate, params));
    },
    time(params) {
      return this.check(_isoTime(ZodISOTime, params));
    },
    duration(params) {
      return this.check(_isoDuration(ZodISODuration, params));
    }
  });
  ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
  });
  ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
    $ZodISODateTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
    $ZodISODate.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
    $ZodISOTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
    $ZodISODuration.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
    $ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
    $ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
    $ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
    $ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
    $ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
    $ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
    $ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
    $ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
    $ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
    $ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
    $ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
    $ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
    $ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
    $ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
    $ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
    $ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
    $ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
    $ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
    $ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
    inst.isFinite = true;
  }, /* @__PURE__ */ derived({
    minValue: (inst) => {
      const { minimum, exclusiveMinimum } = aggregateChecks(inst);
      return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
    },
    maxValue: (inst) => {
      const { maximum, exclusiveMaximum } = aggregateChecks(inst);
      return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
    },
    isInt: (inst) => {
      const { isInt, multipleOf } = aggregateChecks(inst);
      return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
    },
    format: (inst) => aggregateChecks(inst).format ?? null
  }, {
    gt(value, params) {
      return this.check(_gt(value, params));
    },
    gte(value, params) {
      return this.check(_gte(value, params));
    },
    min(value, params) {
      return this.check(_gte(value, params));
    },
    lt(value, params) {
      return this.check(_lt(value, params));
    },
    lte(value, params) {
      return this.check(_lte(value, params));
    },
    max(value, params) {
      return this.check(_lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(_gt(0, params));
    },
    nonnegative(params) {
      return this.check(_gte(0, params));
    },
    negative(params) {
      return this.check(_lt(0, params));
    },
    nonpositive(params) {
      return this.check(_lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(_multipleOf(value, params));
    },
    step(value, params) {
      return this.check(_multipleOf(value, params));
    },
    finite() {
      return this;
    }
  }));
  ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
    $ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
  });
  ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
  });
  ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
    $ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
  });
  ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
    $ZodNever.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
  });
  ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
    inst.element = def.element;
  }, {
    min(n, params) {
      return this.check(_minLength(n, params));
    },
    nonempty(params) {
      return this.check(_minLength(1, params));
    },
    max(n, params) {
      return this.check(_maxLength(n, params));
    },
    length(n, params) {
      return this.check(_length(n, params));
    },
    unwrap() {
      return this.element;
    }
  });
  ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodObjectJIT.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
    installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
  }, {
    keyof() {
      return _enum(Object.keys(this._zod.def.shape));
    },
    catchall(catchall) {
      return this.clone(mergeDefs(this._zod.def, { catchall }));
    },
    passthrough() {
      return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
    },
    loose() {
      return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
    },
    strict() {
      return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
    },
    strip() {
      return this.clone(mergeDefs(this._zod.def, { catchall: undefined }));
    },
    extend(incoming) {
      return extend(this, incoming);
    },
    safeExtend(incoming) {
      return safeExtend(this, incoming);
    },
    merge(other) {
      return merge(this, other);
    },
    pick(mask) {
      return pick(this, mask);
    },
    omit(mask) {
      return omit(this, mask);
    },
    partial(...args) {
      return partial(ZodOptional, this, args[0]);
    },
    exactPartial(...args) {
      return partial(ZodExactOptional, this, args[0], "exactPartial");
    },
    required(...args) {
      return required(ZodNonOptional, this, args[0]);
    }
  });
  ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
    inst.options = def.options;
  });
  ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
    $ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
  });
  ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
  });
  ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
    $ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
    inst.enum = def.entries;
    inst.options = [...inst._zod.values];
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
      const newEntries = {};
      for (const value of values) {
        if (keys.has(value)) {
          newEntries[value] = def.entries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...normalizeParams(params),
        entries: newEntries
      });
    };
    inst.exclude = (values, params) => {
      const newEntries = { ...def.entries };
      for (const value of values) {
        if (keys.has(value)) {
          delete newEntries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...normalizeParams(params),
        entries: newEntries
      });
    };
  });
  ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
    _ensureDefaultMemoizer();
    $ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
    inst._zod.parse = (payload, _ctx) => {
      if (_ctx.direction === "backward") {
        throw new $ZodEncodeError(inst.constructor.name);
      }
      payload.addIssue = (issue2) => {
        if (typeof issue2 === "string") {
          payload.issues.push(issue(issue2, payload.value, def));
        } else {
          const _issue = issue2;
          if (_issue.fatal)
            _issue.continue = false;
          _issue.code ?? (_issue.code = "custom");
          if (!("input" in _issue))
            _issue.input = payload.value;
          _issue.inst ?? (_issue.inst = inst);
          payload.issues.push(issue(_issue));
        }
      };
      const output = def.transform(payload.value, payload);
      if (output instanceof Promise) {
        return output.then((output) => {
          payload.value = output;
          return payload;
        });
      }
      payload.value = output;
      return payload;
    };
  });
  ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
    $ZodExactOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
    $ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
    $ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
  });
  ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
    $ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
    $ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
    $ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
  });
  ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
    $ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
    inst.in = def.in;
    inst.out = def.out;
  });
  ZodPreprocess = /* @__PURE__ */ $constructor("ZodPreprocess", (inst, def) => {
    ZodPipe.init(inst, def);
    $ZodPreprocess.init(inst, def);
  });
  ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
    $ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
    $ZodCustom.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
  });
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/compat.js
var ZodFirstPartyTypeKind;
var init_compat = __esm(() => {
  (function(ZodFirstPartyTypeKind) {})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/iso.js
var init_iso = () => {};

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/coerce.js
var init_coerce = () => {};

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/classic/external.js
var init_external = __esm(() => {
  init_core2();
  init_locales();
  init_iso();
  init_coerce();
  init_schemas2();
  init_checks2();
  init_errors2();
  init_parse3();
  init_compat();
});

// ../../node_modules/.bun/zod@4.6.7/node_modules/zod/index.js
var init_zod = __esm(() => {
  init_external();
  init_external();
});

// ../../packages/plugin-common/src/shared/token-usage.ts
var TOKEN_SOURCES, COST_SOURCES, BILLING_MODES, SessionTokenUsageSchema;
var init_token_usage = __esm(() => {
  init_zod();
  TOKEN_SOURCES = [
    "provider_reported",
    "provider_reported_totals_only",
    "estimated_heuristic"
  ];
  COST_SOURCES = [
    "provider_reported",
    "derived_openrouter",
    "cursor_dashboard_api"
  ];
  BILLING_MODES = ["api", "subscription", "unknown"];
  SessionTokenUsageSchema = object({
    input_tokens: number2().int().nonnegative(),
    output_tokens: number2().int().nonnegative(),
    total_tokens: number2().int().nonnegative(),
    token_source: _enum(TOKEN_SOURCES),
    cost_usd: number2().nonnegative().nullable().optional(),
    cost_source: _enum(COST_SOURCES).nullable().optional(),
    api_equivalent_cost_usd: number2().nonnegative().nullable().optional(),
    api_equivalent_cost_source: _enum(["derived_openrouter", "derived_openrouter_stale"]).nullable().optional(),
    cache_read_tokens: number2().int().nonnegative().optional(),
    cache_creation_tokens: number2().int().nonnegative().optional(),
    cache_creation_5m_tokens: number2().int().nonnegative().optional(),
    cache_creation_1h_tokens: number2().int().nonnegative().optional(),
    reasoning_tokens: number2().int().nonnegative().optional(),
    server_tool_use_input_tokens: number2().int().nonnegative().optional(),
    server_tool_use_output_tokens: number2().int().nonnegative().optional(),
    message_count_with_tokens: number2().int().nonnegative().optional(),
    model_usage: record(string2(), object({
      input_tokens: number2().nonnegative(),
      output_tokens: number2().nonnegative(),
      cache_read_input_tokens: number2().nonnegative().optional(),
      cache_creation_input_tokens: number2().nonnegative().optional(),
      cache_creation_5m_input_tokens: number2().nonnegative().optional(),
      cache_creation_1h_input_tokens: number2().nonnegative().optional(),
      reasoning_tokens: number2().nonnegative().optional(),
      cost_usd: number2().nonnegative().optional(),
      uncomposed_total_tokens: number2().nonnegative().optional()
    })).optional(),
    context_used_percent: number2().nonnegative().max(100).optional(),
    context_window_size: number2().int().nonnegative().optional(),
    context_tokens_used: number2().int().nonnegative().optional(),
    context_token_breakdown: record(string2(), number2().int().nonnegative()).optional(),
    copilot_credits: number2().nonnegative().optional(),
    copilot_sku: string2().min(1).optional(),
    rate_limit_percent: number2().nonnegative().optional(),
    rate_limit_type: string2().optional(),
    rate_limit_is_overage: boolean2().optional(),
    plan: string2().min(1).optional(),
    billing_mode: _enum(BILLING_MODES).optional(),
    overage: boolean2().optional(),
    rate_limits: array(object({
      window: _enum(["5h", "weekly", "monthly"]),
      used_percent: number2().nonnegative(),
      resets_at: string2().optional(),
      credits: number2().nonnegative().optional(),
      individual_limit: number2().nonnegative().optional(),
      limit_name: string2().optional(),
      rate_limit_reached_type: string2().optional()
    })).optional()
  });
});

// ../../packages/plugin-common/src/shared/session-metadata.ts
function validateSessionMetadata(source, metadata) {
  const schema = metadataSchemasBySource[source];
  if (!schema)
    return { valid: true, data: metadata };
  const result = schema.safeParse(metadata);
  if (result.success)
    return { valid: true, data: result.data };
  return { valid: false, error: result.error.message };
}
var HermesSessionMetadataSchema, TokenUsageSchema, RateLimitWindowSchema, CodexSessionMetadataSchema, ClaudeCodeSessionMetadataSchema, GrokBuildSessionMetadataSchema, DshSessionMetadataSchema, OpencodeSessionMetadataSchema, FreebuffSessionMetadataSchema, metadataSchemasBySource;
var init_session_metadata = __esm(() => {
  init_zod();
  init_token_usage();
  HermesSessionMetadataSchema = object({
    trigger: string2(),
    model: string2(),
    ended_at: string2().nullable(),
    end_reason: string2().nullable(),
    is_error: boolean2(),
    input_tokens: number2(),
    output_tokens: number2(),
    cache_read_tokens: number2(),
    cache_write_tokens: number2(),
    reasoning_tokens: number2(),
    cost_usd: number2().nullable(),
    billing_mode: _enum(BILLING_MODES).optional(),
    message_count: number2(),
    tool_call_count: number2(),
    duration_ms: number2().nullable().optional(),
    available_skills_count: number2().nullable().optional(),
    memory_chars: number2().nullable().optional(),
    memory_entry_count: number2().nullable().optional(),
    user_entry_count: number2().nullable().optional(),
    user_chars: number2().nullable().optional()
  });
  TokenUsageSchema = object({
    input_tokens: number2().optional(),
    cached_input_tokens: number2().optional(),
    output_tokens: number2().optional(),
    reasoning_output_tokens: number2().optional(),
    total_tokens: number2().optional()
  });
  RateLimitWindowSchema = object({
    used_percent: number2().optional(),
    window_minutes: number2().optional(),
    resets_at: number2().optional()
  });
  CodexSessionMetadataSchema = object({
    git_branch: string2().optional(),
    entrypoint: string2().optional(),
    model_with_reasoning: string2().optional(),
    models_with_reasoning: array(string2()).optional(),
    token_source: _enum(TOKEN_SOURCES).optional(),
    plan: string2().optional(),
    billing_mode: _enum(BILLING_MODES).optional(),
    overage: boolean2().optional(),
    context_remaining: number2().optional(),
    context_used: number2().optional(),
    five_hour_limit: number2().optional(),
    weekly_limit: number2().optional(),
    used_tokens: number2().optional(),
    input_tokens: number2().optional(),
    output_tokens: number2().optional(),
    cache_read_tokens: number2().optional(),
    reasoning_tokens: number2().optional(),
    model_context_window: number2().optional(),
    token_count_latest: object({
      timestamp: string2().optional(),
      total_token_usage: TokenUsageSchema.optional(),
      last_token_usage: TokenUsageSchema.optional(),
      model_context_window: number2().optional()
    }).optional(),
    rate_limits_latest: object({
      limit_id: string2().optional(),
      plan_type: string2().optional(),
      primary: RateLimitWindowSchema.optional(),
      secondary: RateLimitWindowSchema.optional()
    }).optional()
  });
  ClaudeCodeSessionMetadataSchema = object({
    model: string2().optional(),
    input_tokens: number2().optional(),
    output_tokens: number2().optional(),
    cache_read_tokens: number2().optional(),
    cache_creation_tokens: number2().optional(),
    reasoning_tokens: number2().optional(),
    cost_usd: number2().nullable().optional(),
    cost_source: string2().optional(),
    plan: string2().optional(),
    billing_mode: _enum(BILLING_MODES).optional(),
    overage: boolean2().optional(),
    context_used: number2().optional(),
    context_tokens_used: number2().optional(),
    context_peak_tokens: number2().optional(),
    model_context_window: number2().optional(),
    used_tokens: number2().optional(),
    five_hour_limit: number2().optional(),
    weekly_limit: number2().optional(),
    rate_limits_latest: object({
      limit_id: string2().optional(),
      primary: RateLimitWindowSchema.optional(),
      secondary: RateLimitWindowSchema.optional()
    }).optional(),
    token_data_source: string2().optional()
  }).passthrough();
  GrokBuildSessionMetadataSchema = object({
    model: string2().optional(),
    total_tokens: number2().optional(),
    token_source: _enum(TOKEN_SOURCES).optional(),
    context_used_percent: number2().optional(),
    context_window_size: number2().optional(),
    context_tokens_used: number2().optional(),
    chat_format_version: number2().optional()
  });
  DshSessionMetadataSchema = object({
    model: string2().optional(),
    session_format_version: number2().optional(),
    token_source: _enum(TOKEN_SOURCES).optional(),
    interrupted: boolean2().optional()
  });
  OpencodeSessionMetadataSchema = object({
    model: string2().optional(),
    model_provider: string2().optional(),
    host_version: string2().optional(),
    token_source: _enum(TOKEN_SOURCES).optional(),
    compacted: boolean2().optional(),
    interrupted: boolean2().optional()
  });
  FreebuffSessionMetadataSchema = object({});
  metadataSchemasBySource = {
    codex: CodexSessionMetadataSchema,
    hermes: HermesSessionMetadataSchema,
    "claude-code": ClaudeCodeSessionMetadataSchema,
    claude_code: ClaudeCodeSessionMetadataSchema,
    "claude-desktop": ClaudeCodeSessionMetadataSchema,
    "grok-build": GrokBuildSessionMetadataSchema,
    dsh: DshSessionMetadataSchema,
    opencode: OpencodeSessionMetadataSchema,
    freebuff: FreebuffSessionMetadataSchema
  };
});

// ../../packages/plugin-common/src/ingest/session-id.ts
function normalizeSessionId(sessionId, namespace) {
  if (validate_default(sessionId)) {
    return sessionId;
  }
  return v5_default(sessionId, namespace);
}
function scopedSessionIds(rawId, userId, namespace) {
  return {
    id: v5_default(`${userId}:${rawId}`, namespace),
    legacy_id: normalizeSessionId(rawId, namespace)
  };
}
var init_session_id = __esm(() => {
  init_dist_node();
});

// ../../packages/plugin-common/src/ingest/events.ts
import { basename as basename2 } from "node:path";
function sessionEventId(row) {
  return row.event_id ?? v5_default(`${row.id}:session`, EVENT_NAMESPACE);
}
function messageEventId(row) {
  return row.event_id ?? v5_default(`${row.session_id}:${row.message_index}`, EVENT_NAMESPACE);
}
function batchIdFor(events) {
  return v5_default(events.map((event) => event.id).sort().join(","), BATCH_NAMESPACE);
}
function resolveSessionId(rawId, mapping) {
  if (mapping.scopeSessionIdsToUser) {
    return scopedSessionIds(rawId, mapping.userId, mapping.sessionNamespace);
  }
  return { id: normalizeSessionId(rawId, mapping.sessionNamespace) };
}
function folderName(projectName) {
  if (!projectName)
    return;
  const absolute = /^([/~\\]|[A-Za-z]:[\\/])/.test(projectName);
  return absolute ? basename2(projectName.replace(/[\\/]+$/, "")) : projectName;
}
function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function sessionToEvent(row, mapping, options = {}) {
  const at = row.created_at ?? options.now ?? new Date().toISOString();
  let metadata = asObject(row.metadata);
  if (metadata) {
    const validation = validateSessionMetadata(mapping.source, metadata);
    if (!validation.valid) {
      options.onInvalidMetadata?.(validation.error);
      metadata = undefined;
    }
  }
  const signals = asObject(options.signals) ?? asObject(row.signals);
  const title = row.title?.trim() ? row.title : undefined;
  return {
    id: sessionEventId(row),
    type: "session",
    at,
    session: {
      ...resolveSessionId(row.id, mapping),
      source: mapping.source,
      platform: row.platform ?? mapping.platform,
      ...title ? { title } : {},
      ...row.created_at ? { started_at: row.created_at } : {},
      ...folderName(row.project_name) ? { folder: folderName(row.project_name) } : {},
      ...row.project_id ? { project_id: row.project_id } : {},
      ...metadata ? { metadata } : {},
      ...signals ? { signals } : {}
    }
  };
}
function messageToEvent(row, mapping, options = {}) {
  const role = ROLES.has(row.role) ? row.role : "system";
  const collectionOff = role === "user" && mapping.collection?.user_messages === false || role === "assistant" && mapping.collection?.assistant_messages === false;
  const metadata = asObject(row.metadata);
  return {
    id: messageEventId(row),
    type: "message",
    at: row.created_at ?? options.now ?? new Date().toISOString(),
    session_id: resolveSessionId(row.session_id, mapping).id,
    index: row.message_index,
    role,
    content: collectionOff ? null : row.content ?? null,
    ...metadata ? { metadata } : {}
  };
}
var EVENT_NAMESPACE = "3f6c2a8e-91d4-4b7a-a5e2-6d0c8b1f4e27", BATCH_NAMESPACE = "b84d1e6a-2c97-4f3b-8e15-a0c6d9f27b53", ROLES;
var init_events2 = __esm(() => {
  init_dist_node();
  init_session_metadata();
  init_session_id();
  ROLES = new Set(["user", "assistant", "tool", "system"]);
});

// ../../packages/plugin-common/src/ingest/sender.ts
import { mkdir as mkdir2, readdir as readdir2, unlink as unlink5, writeFile as writeFile3 } from "node:fs/promises";
import { join } from "node:path";
function createEventSender(config) {
  const { zest, logger, onCaptureException } = config;
  async function park(batch, error) {
    if (config.parkedDir) {
      try {
        await mkdir2(config.parkedDir, { recursive: true, mode: 448 });
        await writeFile3(join(config.parkedDir, `${batch.batch_id}.json`), JSON.stringify({ error: { status: error.status, code: error.code }, batch }), { mode: 384 });
        const files = (await readdir2(config.parkedDir)).sort();
        for (const old of files.slice(0, Math.max(0, files.length - MAX_PARKED_BATCHES))) {
          await unlink5(join(config.parkedDir, old)).catch((error) => {
            logger?.debug("Could not prune an old parked batch", error);
          });
        }
      } catch (writeError) {
        logger?.error("Could not write parked batch", writeError);
      }
    }
    logger?.error("Ingest rejected a batch; parked it", {
      batchId: batch.batch_id,
      status: error.status,
      code: error.code,
      events: batch.events.length
    });
    onCaptureException?.(error, SYNC_BATCH_PARKED, "ingest", {
      http_status: error.status,
      error_code: error.code,
      events: batch.events.length
    });
  }
  return async function send(events, auth, workspaceId) {
    const result = { sentIds: [], counts: { sessions: 0, messages: 0, other: 0 } };
    async function sendOne(chunk, ws) {
      const batch = {
        v: 1,
        batch_id: batchIdFor(chunk),
        sent_at: new Date().toISOString(),
        events: chunk
      };
      try {
        const response = await zest.ingest(batch, {
          credential: auth.credential,
          workspaceId: ws
        });
        const rejected = new Set((response.rejected ?? []).map((r) => r.id));
        for (const event of chunk) {
          result.sentIds.push(event.id);
          if (rejected.has(event.id))
            continue;
          if (event.type === "session")
            result.counts.sessions++;
          else if (event.type === "message")
            result.counts.messages++;
          else
            result.counts.other++;
        }
        if (rejected.size > 0) {
          const byCode = {};
          for (const r of response.rejected)
            byCode[r.code] = (byCode[r.code] ?? 0) + 1;
          logger?.warn("Ingest rejected some events; dropping them", byCode);
          onCaptureException?.(new Error(`Ingest rejected ${rejected.size} event(s)`), SYNC_EVENTS_REJECTED, "ingest", { rejected: rejected.size, ...byCode });
        }
        return true;
      } catch (error) {
        if (!(error instanceof ApiError)) {
          result.error = error;
          return false;
        }
        if (error.status === 413 && chunk.length > 1) {
          const half = Math.ceil(chunk.length / 2);
          return await sendOne(chunk.slice(0, half), ws) && sendOne(chunk.slice(half), ws);
        }
        if (error.status === 400 || error.status === 413 || error.status === 415) {
          await park(batch, error);
          result.sentIds.push(...chunk.map((event) => event.id));
          return true;
        }
        if (error.status === 403 && ws) {
          logger?.warn("Queued workspace not accessible; sending to the default workspace");
          await zest.config({ force: true });
          return sendOne(chunk, undefined);
        }
        if (error.status === 401 && auth.source === "zest2") {
          await zest.auth.invalidate("ingest_401");
        }
        logger?.warn("Ingest failed", { status: error.status, code: error.code });
        result.error = error;
        return false;
      }
    }
    await sendOne(events, workspaceId);
    return result;
  };
}
var MAX_PARKED_BATCHES = 20;
var init_sender = __esm(() => {
  init_events();
  init_client();
  init_events2();
});

// ../../packages/plugin-common/src/ingest/uploader.ts
import { dirname as dirname4, join as join2 } from "node:path";
function getMaxMessageIndexPerSession(messages) {
  const maxIndices = new Map;
  for (const message of messages) {
    if (!message.session_id || message.message_index === undefined)
      continue;
    const currentMax = maxIndices.get(message.session_id) ?? -1;
    if (message.message_index > currentMax) {
      maxIndices.set(message.session_id, message.message_index);
    }
  }
  return maxIndices;
}
function partitionSessionsByIdentity(sessions, userId) {
  const owned = [];
  const legacyIds = new Set;
  const mismatched = [];
  for (const session of sessions) {
    if (!session.id)
      continue;
    if (!session.user_id) {
      legacyIds.add(session.id);
      owned.push(session);
      continue;
    }
    if (session.user_id !== userId) {
      mismatched.push(session);
      continue;
    }
    owned.push(session);
  }
  return { owned, legacyIds, mismatched };
}
function partitionMessagesByIdentity(messages, userId, parentSessions) {
  const owned = [];
  const legacyIds = new Set;
  const mismatched = [];
  const ownedSessionIds = new Set(parentSessions?.owned.map((s) => s.id));
  const mismatchedSessionIds = new Set(parentSessions?.mismatched.map((s) => s.id));
  for (const message of messages) {
    const key = messageEventId(message);
    if (mismatchedSessionIds.has(message.session_id)) {
      mismatched.push(message);
      continue;
    }
    if (ownedSessionIds.has(message.session_id) || !message.user_id) {
      if (!message.user_id)
        legacyIds.add(key);
      owned.push(message);
      continue;
    }
    if (message.user_id !== userId) {
      mismatched.push(message);
      continue;
    }
    owned.push(message);
  }
  return { owned, legacyIds, mismatched };
}
function newest(a, b) {
  const at = a.created_at ? Date.parse(a.created_at) : 0;
  const bt = b.created_at ? Date.parse(b.created_at) : 0;
  return bt >= at ? b : a;
}
function dedupe(rows, key, eventId) {
  const kept = new Map;
  const ids = new Map;
  for (const row of rows) {
    const k = key(row);
    const existing = kept.get(k);
    kept.set(k, existing ? newest(existing, row) : row);
    ids.set(k, [...ids.get(k) ?? [], eventId(row)]);
  }
  const covers = new Map;
  for (const [k, row] of kept)
    covers.set(eventId(row), ids.get(k) ?? []);
  return { rows: [...kept.values()], covers };
}
function chunkEvents(events, maxEvents) {
  const batches = [];
  let current = [];
  let bytes = 0;
  for (const event of events) {
    const size = JSON.stringify(event).length;
    if (current.length > 0 && (current.length >= maxEvents || bytes + size > MAX_BATCH_JSON_BYTES)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(event);
    bytes += size;
  }
  if (current.length > 0)
    batches.push(current);
  return batches;
}
function createChatUploader(config) {
  const {
    zest,
    sessionsQueueFile,
    messagesQueueFile,
    minMessagesPerSession: minMessages,
    staleSessionAgeMs,
    logger,
    readQueue,
    atomicUpdateQueue,
    onCaptureException
  } = config;
  const maxBatches = config.maxBatchesPerCycle ?? DEFAULT_MAX_BATCHES;
  const minMessagesFor = () => typeof minMessages === "function" ? minMessages() : minMessages;
  const sendEvents = createEventSender({
    zest,
    logger,
    onCaptureException,
    parkedDir: config.parkedDir ?? join2(dirname4(sessionsQueueFile), "parked")
  });
  const staleSessionAgeDays = Math.round(staleSessionAgeMs / (24 * 60 * 60 * 1000));
  async function readSignals(sessionId) {
    const signals = config.readSessionSignals ? await config.readSessionSignals(sessionId) : null;
    const privacy = config.privacyManager;
    if (signals === null || signals === undefined || !privacy)
      return signals;
    if (!privacy.isInitialized()) {
      logger?.warn(`Signals for ${sessionId} held back: the privacy redactor is not initialized`);
      return null;
    }
    return redactStrings(signals, privacy);
  }
  function categorizeSessions(sessions, maxMessageIndexBySession) {
    const now = Date.now();
    const staleThreshold = now - staleSessionAgeMs;
    const minMessagesPerSession = minMessagesFor();
    const valid = [];
    const stale = [];
    const pending = [];
    for (const session of sessions) {
      if (!session.id)
        continue;
      const maxMessageIndex = maxMessageIndexBySession.get(session.id) ?? -1;
      const sessionAge = session.created_at ? new Date(session.created_at).getTime() : now;
      if (session.patch || maxMessageIndex >= minMessagesPerSession - 1) {
        valid.push(session);
      } else if (sessionAge < staleThreshold) {
        stale.push(session);
      } else {
        pending.push(session);
      }
    }
    const ids = (rows) => new Set(rows.map((s) => s.id).filter((id) => !!id));
    return {
      valid,
      stale,
      pending,
      validIds: ids(valid),
      staleIds: ids(stale),
      pendingIds: ids(pending)
    };
  }
  async function removeSent(sentIds, staleIds = new Set) {
    if (sentIds.size === 0 && staleIds.size === 0)
      return;
    await atomicUpdateQueue(sessionsQueueFile, (rows) => rows.filter((s) => !(s.id && staleIds.has(s.id)) && !sentIds.has(sessionEventId(s))));
    await atomicUpdateQueue(messagesQueueFile, (rows) => rows.filter((m) => !staleIds.has(m.session_id) && !sentIds.has(messageEventId(m))));
  }
  async function uploadChatData() {
    const nothing = { sessions: 0, messages: 0 };
    try {
      const queuedSessions = await readQueue(sessionsQueueFile);
      const queuedMessages = await readQueue(messagesQueueFile);
      if (queuedSessions.length === 0 && queuedMessages.length === 0) {
        logger?.debug("No chat data to upload");
        return { success: true, uploaded: nothing };
      }
      const active = await zest.auth.get();
      if (!active) {
        return { success: false, uploaded: nothing, errorCategory: "auth_error" };
      }
      const pluginConfig = await zest.config();
      if (!pluginConfig) {
        return { success: false, uploaded: nothing, errorCategory: "network_error" };
      }
      const sessionIdentity = partitionSessionsByIdentity(queuedSessions, active.userId);
      const messageIdentity = partitionMessagesByIdentity(queuedMessages, active.userId, sessionIdentity);
      if (sessionIdentity.legacyIds.size > 0 || messageIdentity.legacyIds.size > 0) {
        await atomicUpdateQueue(sessionsQueueFile, (items) => items.map((s) => s.id && sessionIdentity.legacyIds.has(s.id) && !s.user_id ? { ...s, user_id: active.userId, workspace_id: active.workspaceId ?? null } : s));
        await atomicUpdateQueue(messagesQueueFile, (items) => items.map((m) => messageIdentity.legacyIds.has(messageEventId(m)) && !m.user_id ? { ...m, user_id: active.userId } : m));
        logger?.info(`Adopting ${sessionIdentity.legacyIds.size} unstamped session(s) and ${messageIdentity.legacyIds.size} unstamped message(s) under the current identity`);
      }
      const observedAt = new Date().toISOString();
      const staleThreshold = Date.now() - staleSessionAgeMs;
      const firstSeen = (row) => Date.parse(row.first_seen_mismatched_at ?? observedAt);
      const mismatchedSessionIds = new Set(sessionIdentity.mismatched.map(sessionEventId));
      const mismatchedMessageIds = new Set(messageIdentity.mismatched.map(messageEventId));
      const purgeSessions = new Set(sessionIdentity.mismatched.filter((s) => firstSeen(s) < staleThreshold).map(sessionEventId));
      const purgeMessages = new Set(messageIdentity.mismatched.filter((m) => firstSeen(m) < staleThreshold).map(messageEventId));
      if (mismatchedSessionIds.size > 0 || mismatchedMessageIds.size > 0) {
        await atomicUpdateQueue(sessionsQueueFile, (items) => items.filter((s) => !purgeSessions.has(sessionEventId(s))).map((s) => mismatchedSessionIds.has(sessionEventId(s)) && !s.first_seen_mismatched_at ? { ...s, first_seen_mismatched_at: observedAt } : s));
        await atomicUpdateQueue(messagesQueueFile, (items) => items.filter((m) => !purgeMessages.has(messageEventId(m))).map((m) => mismatchedMessageIds.has(messageEventId(m)) && !m.first_seen_mismatched_at ? { ...m, first_seen_mismatched_at: observedAt } : m));
      }
      if (purgeSessions.size > 0 || purgeMessages.size > 0) {
        logger?.warn(`Purging ${purgeSessions.size} session(s) and ${purgeMessages.size} message(s) belonging to a different account, unclaimed for over ${staleSessionAgeDays} days`);
        onCaptureException?.(new Error(`Purged ${purgeSessions.size} mismatched sessions, ${purgeMessages.size} mismatched messages`), QUEUE_MISMATCHED_ENTRIES_PURGED, "chat-uploader", { sessions: purgeSessions.size, messages: purgeMessages.size });
      }
      const minMessagesPerSession = minMessagesFor();
      const categories = categorizeSessions(sessionIdentity.owned, getMaxMessageIndexPerSession(messageIdentity.owned));
      if (categories.stale.length > 0) {
        logger?.info(`Removing ${categories.stale.length} stale sessions (< ${minMessagesPerSession} messages, > ${staleSessionAgeDays} days old)`);
        await removeSent(new Set, categories.staleIds);
      }
      if (categories.pending.length > 0) {
        logger?.debug(`Keeping ${categories.pending.length} pending sessions (< ${minMessagesPerSession} messages)`);
      }
      const uploadable = messageIdentity.owned.filter((m) => !categories.pendingIds.has(m.session_id) && !categories.staleIds.has(m.session_id));
      const sessions = dedupe(categories.valid, (s) => s.id, sessionEventId);
      const messages = dedupe(uploadable, (m) => `${m.session_id}:${m.message_index}`, messageEventId);
      const mapping = {
        source: config.source,
        platform: config.platform,
        sessionNamespace: config.sessionNamespace,
        scopeSessionIdsToUser: config.scopeSessionIdsToUser,
        userId: active.userId,
        collection: pluginConfig.collection
      };
      const groups = new Map;
      const add = (ws, event) => {
        const group = groups.get(ws);
        if (group)
          group.push(event);
        else
          groups.set(ws, [event]);
      };
      const workspaceOf = new Map;
      for (const s of queuedSessions)
        if (s.id)
          workspaceOf.set(s.id, s.workspace_id ?? "");
      for (const s of sessions.rows) {
        const signals = await readSignals(s.id);
        const event = sessionToEvent(s, mapping, {
          signals,
          onInvalidMetadata: (error) => logger?.warn(`Invalid session metadata for ${s.id}: ${error}`)
        });
        add(s.workspace_id ?? "", event);
      }
      for (const m of messages.rows) {
        add(workspaceOf.get(m.session_id) ?? "", messageToEvent(m, mapping));
      }
      const maxEvents = Math.min(config.maxEventsPerBatch ?? DEFAULT_MAX_EVENTS, pluginConfig.ingest?.max_events ?? DEFAULT_MAX_EVENTS);
      const plan = [...groups].flatMap(([ws, events]) => chunkEvents(events, maxEvents).map((chunk) => ({ ws, chunk })));
      if (plan.length > maxBatches) {
        logger?.info(`Drain throttle: sending ${maxBatches} of ${plan.length} batches this cycle`);
        onCaptureException?.(new Error(`Drain throttle active: ${plan.length} batches queued`), SYNC_DRAIN_THROTTLED, "chat-uploader", { batches: plan.length, cycle_cap: maxBatches });
      }
      const covers = new Map([...sessions.covers, ...messages.covers]);
      const uploaded = { sessions: 0, messages: 0 };
      for (const { ws, chunk } of plan.slice(0, maxBatches)) {
        const result = await sendEvents(chunk, active, ws || undefined);
        const sentIds = new Set;
        for (const id of result.sentIds)
          for (const c of covers.get(id) ?? [id])
            sentIds.add(c);
        uploaded.sessions += result.counts.sessions;
        uploaded.messages += result.counts.messages;
        await removeSent(sentIds);
        if (result.error) {
          return {
            success: false,
            uploaded,
            errorCategory: classifyApiError(result.error),
            errorDetail: errorDetailOf(result.error),
            retryAfterS: result.error instanceof ApiError ? result.error.retryAfterS : undefined
          };
        }
      }
      if (uploaded.sessions + uploaded.messages > 0) {
        logger?.info(`✓ Uploaded ${uploaded.sessions} session(s), ${uploaded.messages} message(s)`);
      }
      return { success: true, uploaded };
    } catch (error) {
      logger?.error("Failed to upload chat data", error);
      const category = classifyApiError(error);
      if (error instanceof Error) {
        onCaptureException?.(error, SYNC_CHAT_UPLOAD_FAILED, "chat-uploader", {
          ...buildSyncProperties({ syncErrorType: "upload_failed" }),
          error_category: category
        });
      }
      return { success: false, uploaded: nothing, errorCategory: category };
    }
  }
  async function uploadChatDataWithRetry(maxRetries = 3, backoffMs = 5000) {
    let lastResult = null;
    for (let attempt = 1;attempt <= maxRetries; attempt++) {
      const result = await uploadChatData();
      if (result.success)
        return result;
      lastResult = result;
      if (result.errorCategory && !isRetryableCategory(result.errorCategory))
        return result;
      if (result.retryAfterS !== undefined)
        return result;
      logger?.warn(`Chat upload attempt ${attempt}/${maxRetries} failed`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
      }
    }
    logger?.error(`Chat upload failed after ${maxRetries} attempts`);
    return lastResult ?? { success: false, uploaded: { sessions: 0, messages: 0 } };
  }
  async function getIdentityStats(userId) {
    const queuedSessions = await readQueue(sessionsQueueFile);
    const queuedMessages = await readQueue(messagesQueueFile);
    const sessions = partitionSessionsByIdentity(queuedSessions, userId);
    return {
      mismatchedSessions: sessions.mismatched.length,
      mismatchedMessages: partitionMessagesByIdentity(queuedMessages, userId, sessions).mismatched.length
    };
  }
  return { uploadChatData, uploadChatDataWithRetry, categorizeSessions, getIdentityStats };
}
var DEFAULT_MAX_EVENTS = 2000, DEFAULT_MAX_BATCHES = 5, MAX_BATCH_JSON_BYTES;
var init_uploader = __esm(() => {
  init_events();
  init_properties();
  init_client();
  init_queue_manager();
  init_error_classifier();
  init_events2();
  init_sender();
  MAX_BATCH_JSON_BYTES = 12 * 1024 * 1024;
});

// ../../packages/plugin-common/src/log-rotation/log-rotation.ts
import { readdir as readdir3, unlink as unlink6 } from "node:fs/promises";
import { join as join3 } from "node:path";
function getDateString() {
  return new Date().toISOString().split("T")[0];
}
function getDatedLogPath(logsDir, logPrefix) {
  const dateStr = getDateString();
  return join3(logsDir, `${logPrefix}-${dateStr}.log`);
}
function parseDateFromFilename(filename, logPrefix) {
  const pattern = new RegExp(`^${logPrefix}-(\\d{4}-\\d{2}-\\d{2})\\.log$`);
  const match = filename.match(pattern);
  if (!match) {
    return null;
  }
  const date = new Date(match[1] + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}
function createLogRotation(config) {
  const { logsDir, retentionDays, logger } = config;
  const lastCleanupTime = {};
  async function cleanupStaleLogs(logPrefix) {
    const now = Date.now();
    const lastCleanup = lastCleanupTime[logPrefix] || 0;
    if (now - lastCleanup < CLEANUP_THROTTLE_MS) {
      return;
    }
    lastCleanupTime[logPrefix] = now;
    try {
      await ensureDirectory(logsDir);
      const files = await readdir3(logsDir);
      const cutoffDate = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
      for (const file of files) {
        const fileDate = parseDateFromFilename(file, logPrefix);
        if (fileDate && fileDate < cutoffDate) {
          const filePath = join3(logsDir, file);
          try {
            await unlink6(filePath);
          } catch (error) {
            logger?.error(`Failed to delete old log file ${file}`, error);
          }
        }
      }
    } catch (error) {
      logger?.error("Failed to cleanup old logs", error);
    }
  }
  async function forceCleanupStaleLogs(logPrefix) {
    lastCleanupTime[logPrefix] = 0;
    await cleanupStaleLogs(logPrefix);
  }
  return { cleanupStaleLogs, forceCleanupStaleLogs };
}
var CLEANUP_THROTTLE_MS;
var init_log_rotation = __esm(() => {
  init_fs_utils();
  CLEANUP_THROTTLE_MS = 60 * 60 * 1000;
});

// ../../packages/plugin-common/src/logger/logger.ts
import { appendFile as appendFile2 } from "node:fs/promises";
import { dirname as dirname5 } from "node:path";
async function flushLogs() {
  await Promise.all([...pendingWrites]);
}
function registerBeforeExit() {
  if (beforeExitRegistered)
    return;
  beforeExitRegistered = true;
  process.on("beforeExit", () => {
    flushLogs();
  });
}
function stackFrames(error) {
  const frames = (error.stack ?? "").split(`
`).filter((line) => /^\s+at /.test(line));
  return frames.length > 0 ? `
${frames.join(`
`)}` : "";
}
function describeForLog(value) {
  return value instanceof Error ? describeError(value) + stackFrames(value) : describeError(value);
}
function formatArg(arg) {
  if (arg === null || typeof arg !== "object" || arg instanceof Error)
    return describeForLog(arg);
  try {
    return JSON.stringify(arg, (_key, value) => value instanceof Error ? describeForLog(value) : value) ?? describeError(arg);
  } catch {
    return describeError(arg);
  }
}
function formatArgs(args) {
  if (args.length === 0)
    return "";
  return ` ${args.map(formatArg).join(" ")}`;
}
function writeToFile(rotation, logPrefix, level, message, args) {
  const task = (async () => {
    try {
      const logFilePath = rotation.getDatedLogPath(logPrefix);
      await ensureDirectory(dirname5(logFilePath));
      const timestamp = new Date().toISOString();
      await appendFile2(logFilePath, `[${timestamp}] ${level}: ${message}${formatArgs(args)}
`);
      rotation.cleanupStaleLogs(logPrefix);
    } catch {}
  })();
  pendingWrites.add(task);
  task.finally(() => pendingWrites.delete(task));
}
function createLogger(config) {
  const { prefix, logRotation, logPrefix = "plugin", console: toConsole = true } = config;
  let minLevel = "info";
  registerBeforeExit();
  const logger = {
    setLevel(level) {
      minLevel = level;
    },
    debug(message, ...args) {
      if (levels.debug >= levels[minLevel]) {
        writeToFile(logRotation, logPrefix, "DEBUG", message, args);
      }
    },
    info(message, ...args) {
      if (levels.info >= levels[minLevel]) {
        writeToFile(logRotation, logPrefix, "INFO", message, args);
      }
    },
    warn(message, ...args) {
      if (levels.warn >= levels[minLevel]) {
        if (toConsole)
          console.warn(`[${prefix}:Warn] ${message}`, ...args);
        writeToFile(logRotation, logPrefix, "WARN", message, args);
      }
    },
    error(message, error) {
      if (levels.error >= levels[minLevel]) {
        if (toConsole)
          console.error(`[${prefix}:Error] ${message}`, error ?? "");
        writeToFile(logRotation, logPrefix, "ERROR", message, error === undefined ? [] : [error]);
      }
    }
  };
  defaultHandledLogger(logger);
  return { logger, flushLogs };
}
var levels, pendingWrites, beforeExitRegistered = false;
var init_logger = __esm(() => {
  init_fs_utils();
  levels = { debug: 0, info: 1, warn: 2, error: 3 };
  pendingWrites = new Set;
});

// ../../packages/plugin-common/src/metrics/sync-metrics-manager.ts
import { readFile as readFile4, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname6 } from "node:path";
function createSyncMetricsManager(config) {
  const { metricsFile, retentionMs = DEFAULT_RETENTION_MS, logger } = config;
  const withFileLock = resolveFileLock(config.withFileLock);
  async function readMetrics() {
    try {
      const content = await readFile4(metricsFile, "utf8");
      const lines = content.trim().split(`
`).filter(Boolean);
      const results = [];
      for (const line of lines) {
        try {
          results.push(JSON.parse(line));
        } catch {
          logger?.warn("Skipping corrupted line in sync metrics file");
        }
      }
      return results;
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
  async function writeMetrics(entries) {
    await ensureDirectory(dirname6(metricsFile));
    const content = entries.map((entry) => JSON.stringify(entry)).join(`
`) + (entries.length > 0 ? `
` : "");
    await writeFile4(metricsFile, content, "utf8");
  }
  async function recordSyncMetric(entry) {
    try {
      await withFileLock(metricsFile, async () => {
        const existingMetrics = await readMetrics();
        const cutoffTime = Date.now() - retentionMs;
        const recentMetrics = existingMetrics.filter((m) => m.timestamp > cutoffTime);
        recentMetrics.push(entry);
        await writeMetrics(recentMetrics);
        logger?.debug("Recorded sync metric", {
          success: entry.success,
          uploaded: entry.uploaded,
          totalMetrics: recentMetrics.length
        });
      });
    } catch (error) {
      logger?.error("Failed to record sync metric", error);
    }
  }
  async function getLastHourMetrics() {
    try {
      const allMetrics = await readMetrics();
      const cutoffTime = Date.now() - retentionMs;
      return allMetrics.filter((m) => m.timestamp > cutoffTime);
    } catch (error) {
      logger?.error("Failed to read sync metrics", error);
      return [];
    }
  }
  async function aggregateLastHourStats() {
    const metrics = await getLastHourMetrics();
    const synced = {
      sessions: 0,
      messages: 0
    };
    let errors = 0;
    let lastSyncAt = null;
    for (const metric of metrics) {
      if (metric.success) {
        synced.sessions += metric.uploaded.sessions;
        synced.messages += metric.uploaded.messages;
        if (lastSyncAt === null || metric.timestamp > lastSyncAt) {
          lastSyncAt = metric.timestamp;
        }
      } else {
        errors++;
      }
    }
    const total = synced.sessions + synced.messages;
    return { synced, total, errors, lastSyncAt };
  }
  return { recordSyncMetric, getLastHourMetrics, aggregateLastHourStats };
}
var DEFAULT_RETENTION_MS;
var init_sync_metrics_manager = __esm(() => {
  init_file_lock();
  init_fs_utils();
  DEFAULT_RETENTION_MS = 60 * 60 * 1000;
});

// ../../packages/plugin-common/src/sync/circuit-breaker.ts
function createCircuitBreaker(opts) {
  const logger = opts?.logger;
  const now = opts?.now ?? Date.now;
  let state = "CLOSED" /* CLOSED */;
  let consecutiveFailures = 0;
  let currentCooldownMs = INITIAL_COOLDOWN_MS;
  let openedAt = 0;
  function canProceed() {
    if (state === "CLOSED" /* CLOSED */) {
      return true;
    }
    if (state === "OPEN" /* OPEN */) {
      const elapsed = now() - openedAt;
      if (elapsed >= currentCooldownMs) {
        state = "HALF_OPEN" /* HALF_OPEN */;
        logger?.info(`Circuit breaker HALF_OPEN — allowing probe request (cooldown was ${currentCooldownMs}ms)`);
        return true;
      }
      return false;
    }
    return true;
  }
  function recordSuccess() {
    if (state === "HALF_OPEN" /* HALF_OPEN */) {
      logger?.info("Circuit breaker CLOSED — probe succeeded, resuming normal operation");
    }
    consecutiveFailures = 0;
    currentCooldownMs = INITIAL_COOLDOWN_MS;
    state = "CLOSED" /* CLOSED */;
  }
  function recordFailure() {
    consecutiveFailures++;
    if (state === "HALF_OPEN" /* HALF_OPEN */) {
      currentCooldownMs = Math.min(currentCooldownMs * COOLDOWN_MULTIPLIER, MAX_COOLDOWN_MS);
      state = "OPEN" /* OPEN */;
      openedAt = now();
      logger?.warn(`Circuit breaker OPEN — probe failed, cooldown doubled to ${currentCooldownMs}ms`);
      return;
    }
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      state = "OPEN" /* OPEN */;
      openedAt = now();
      logger?.warn(`Circuit breaker OPEN — ${consecutiveFailures} consecutive failures, cooldown ${currentCooldownMs}ms`);
    }
  }
  function getState() {
    return state;
  }
  function getCooldownMs() {
    return currentCooldownMs;
  }
  return { canProceed, recordSuccess, recordFailure, getState, getCooldownMs };
}
var FAILURE_THRESHOLD = 3, INITIAL_COOLDOWN_MS = 60000, MAX_COOLDOWN_MS = 600000, COOLDOWN_MULTIPLIER = 2;
var init_circuit_breaker = () => {};

// ../../packages/plugin-common/src/sync/staleness-detector.ts
function shouldAlertStuck(input) {
  const { lastSuccessAt, now, thresholdMs, lastAlertedAt } = input;
  const isStuck = lastSuccessAt !== null && now - lastSuccessAt > thresholdMs;
  const dueForBeat = lastAlertedAt === null || now - lastAlertedAt >= thresholdMs;
  return isStuck && dueForBeat;
}
async function maybeAlertSyncStuck(deps, cycle) {
  const {
    readSyncStatus,
    markStuckAlerted,
    getQueueStats,
    onCaptureException,
    thresholdMs,
    logger
  } = deps;
  try {
    const { lastSuccessAt, stuckAlertedAt } = readSyncStatus();
    if (!shouldAlertStuck({
      lastSuccessAt,
      now: cycle.now,
      thresholdMs,
      lastAlertedAt: stuckAlertedAt
    })) {
      return;
    }
    const minutesStuck = (cycle.now - lastSuccessAt) / 60000;
    const queue = await getQueueStats();
    await onCaptureException(new Error(`Sync stuck: no successful sync in ${minutesStuck.toFixed(1)} minutes`), SYNC_STUCK, "sync", {
      minutes_stuck: minutesStuck,
      ...cycle.errorType && { error_type: cycle.errorType },
      ...cycle.errorDetail && {
        http_status: cycle.errorDetail.httpStatus,
        error_code: cycle.errorDetail.code
      },
      queue_sessions: queue.sessions,
      queue_messages: queue.messages
    });
    await markStuckAlerted(cycle.now);
  } catch (error) {
    logger?.error("Failed to evaluate sync staleness alarm", error);
  }
}
var DEFAULT_SYNC_STALENESS_THRESHOLD_MS;
var init_staleness_detector = __esm(() => {
  init_events();
  DEFAULT_SYNC_STALENESS_THRESHOLD_MS = 10 * 60000;
});

// ../../packages/plugin-common/src/sync/sync-queued.ts
async function ensurePrivacy(config, settings) {
  const privacy = config.privacyManager;
  if (!privacy || privacy.isInitialized())
    return;
  try {
    await privacy.initialize({ settings, logger: config.logger });
  } catch (error) {
    config.logger.warn("Privacy redactor failed to initialize; signals are held back", error);
  }
}
function errorTypeFor(category) {
  switch (category) {
    case "server_overload":
    case "rate_limited":
      return "server_overload";
    case "network_error":
      return "network_error";
    case "auth_error":
      return "not_authenticated";
    case "data_error":
      return "data_error";
    default:
      return "upload_failed";
  }
}
function createSyncQueued(config) {
  const { logger, zest, uploader, loadSettings, getQueueStats } = config;
  const breaker = config.circuitBreaker ?? createCircuitBreaker({ logger });
  const notAuthenticated = `Not signed in — run ${config.loginCommand}`;
  async function fail(errorType, errorMessage, detail) {
    const now = Date.now();
    await config.recordSyncMetric({
      timestamp: now,
      success: false,
      uploaded: { sessions: 0, messages: 0 },
      errorType
    }).catch((error) => logger.error("Failed to record sync metric", error));
    await config.writeSyncStatus({
      hasError: true,
      errorType,
      errorMessage,
      lastErrorAt: now,
      lastSuccessAt: null
    }).catch((error) => logger.error("Failed to write sync error to status cache", error));
    if (config.readSyncStatus && config.markStuckAlerted && config.onCaptureException) {
      await maybeAlertSyncStuck({
        readSyncStatus: config.readSyncStatus,
        markStuckAlerted: config.markStuckAlerted,
        getQueueStats,
        onCaptureException: config.onCaptureException,
        thresholdMs: config.stalenessThresholdMs ?? DEFAULT_SYNC_STALENESS_THRESHOLD_MS,
        logger
      }, { now, errorType, errorDetail: detail });
    }
  }
  return async function syncQueued() {
    let settings;
    try {
      settings = await loadSettings();
    } catch (error) {
      return {
        status: "settings_invalid",
        message: describeError(error)
      };
    }
    if (!settings.enableRemotePersistence) {
      return { status: "remote_disabled", message: "Captured locally — remote sync disabled" };
    }
    const identity = await zest.auth.identity();
    if (!identity)
      return { status: "not_authenticated", message: notAuthenticated };
    await ensurePrivacy(config, settings.privacy);
    const stats = await getQueueStats();
    if (stats.sessions === 0 && stats.messages === 0) {
      await config.clearSyncError();
      return { status: "ok", message: "No data to sync" };
    }
    if (!breaker.canProceed()) {
      return {
        status: "sync_unavailable",
        message: "Queued locally — Zest is not answering, retrying shortly"
      };
    }
    const result = await uploader.uploadChatDataWithRetry(config.maxRetries ?? 2);
    if (result.success) {
      breaker.recordSuccess();
      const { sessions, messages } = result.uploaded;
      await config.recordSyncMetric({ timestamp: Date.now(), success: true, uploaded: result.uploaded }).catch((error) => logger.error("Failed to record sync metric", error));
      await config.clearSyncError().catch((error) => logger.error("Failed to clear sync error in status cache", error));
      if (sessions + messages === 0)
        return { status: "ok", message: "No data ready to sync" };
      const parts = [];
      if (sessions > 0)
        parts.push(`${sessions} sessions`);
      if (messages > 0)
        parts.push(`${messages} messages`);
      return { status: "ok", message: `Synced ${parts.join(", ")}`, uploaded: result.uploaded };
    }
    const errorType = errorTypeFor(result.errorCategory);
    if (errorType === "server_overload" || errorType === "network_error")
      breaker.recordFailure();
    if (errorType === "not_authenticated") {
      if ((await zest.auth.state()).status === "awaiting_migration") {
        return {
          status: "sync_unavailable",
          message: "Queued locally — your account is still moving to Zest 2"
        };
      }
      await fail(errorType, `Auth required - run ${config.loginCommand}.`, result.errorDetail);
      return { status: "not_authenticated", message: notAuthenticated };
    }
    if (errorType === "network_error" || errorType === "server_overload") {
      const message = "Queued locally — could not reach Zest";
      await fail(errorType, message, result.errorDetail);
      return { status: "sync_unavailable", message };
    }
    await fail(errorType, "Upload failed.", result.errorDetail);
    return { status: "upload_failed", message: "Sync failed: upload failed" };
  };
}
var init_sync_queued = __esm(() => {
  init_circuit_breaker();
  init_staleness_detector();
});

// ../../packages/plugin-common/src/auth/device-login.ts
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
async function openBrowserBestEffort(openBrowser, url, logger, print = console.log) {
  let reported = false;
  const failed = (error) => {
    if (reported)
      return;
    reported = true;
    logger.warn("Failed to open browser automatically", error);
    print(`⚠️  Could not open a browser, open the URL above manually
`);
  };
  const onUncaught = (error) => {
    if (!isSpawnError(error))
      throw error;
    failed(error);
  };
  process.on("uncaughtException", onUncaught);
  try {
    const opener = await openBrowser(url);
    if (opener instanceof EventEmitter)
      opener.on("error", failed);
    await new Promise((resolve) => setImmediate(resolve));
  } catch (error) {
    failed(error);
  } finally {
    process.off("uncaughtException", onUncaught);
  }
}
async function runDeviceLogin(options) {
  const { api, logger, signal } = options;
  const print = options.print ?? console.log;
  const { data: code } = await api.request("/api/auth/device/code", {
    body: { client_id: api.clientId, scope: "plugin" },
    signal
  });
  const url = code.verification_uri_complete ?? code.verification_uri;
  if (!isOnApiHost(url, api.apiBase())) {
    throw new Error(`The sign-in page is not on ${api.apiBase()}; not opening it`);
  }
  print(`
\uD83D\uDD10 Approve this sign-in in your browser: ${url}`);
  print(`   Code: ${code.user_code}
`);
  options.onDeviceCode?.({ userCode: code.user_code, verificationUrl: url });
  signal?.throwIfAborted();
  if (options.openBrowser)
    await openBrowserBestEffort(options.openBrowser, url, logger, print);
  print(`⏳ Waiting for approval...
`);
  let interval = Math.max(1, code.interval || 5);
  const deadline = Date.now() + code.expires_in * 1000;
  while (Date.now() < deadline) {
    await delay(interval * 1000, undefined, { signal });
    try {
      const { data } = await api.request("/api/auth/device/token", {
        body: { grant_type: DEVICE_GRANT, device_code: code.device_code, client_id: api.clientId },
        signal
      });
      if (data?.access_token) {
        print("✅ Approved");
        return data.access_token;
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (!(error instanceof ApiError))
        throw error;
      if (error.code === "authorization_pending")
        continue;
      if (error.code === "slow_down") {
        interval += 5;
        continue;
      }
      if (error.code === "access_denied") {
        throw new DeviceLoginError("denied", "Sign-in was denied in the browser");
      }
      if (error.code === "expired_token") {
        throw new DeviceLoginError("expired", "The sign-in code expired. Please try again.");
      }
      logger.warn("Device login poll failed", { status: error.status, code: error.code });
    }
  }
  throw new DeviceLoginError("timeout", "Timed out waiting for approval");
}
var isSpawnError = (error) => typeof error?.syscall === "string" && error.syscall.startsWith("spawn"), DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code", DeviceLoginError;
var init_device_login = __esm(() => {
  init_base();
  init_client();
  DeviceLoginError = class DeviceLoginError extends Error {
    reason;
    constructor(reason, message) {
      super(message);
      this.reason = reason;
      this.name = "DeviceLoginError";
    }
  };
});

// ../../packages/plugin-common/src/auth/legacy.ts
import { readFile as readFile5 } from "node:fs/promises";
async function readLegacySessionFile(path) {
  try {
    const session = JSON.parse(await readFile5(path, "utf8"));
    if (!session?.accessToken || !session.userId)
      return null;
    return {
      accessToken: session.accessToken,
      userId: session.userId,
      email: session.email ?? "",
      workspaceId: session.workspaceId,
      workspaceName: session.workspaceName
    };
  } catch (error) {
    logHandled("legacy session file missing, unreadable or not JSON; no old login", withoutParsedInput(error));
    return null;
  }
}
var init_legacy = () => {};

// ../../packages/plugin-common/src/auth/store.ts
import { chmod as chmod2, mkdir as mkdir3, readFile as readFile6 } from "node:fs/promises";
import { dirname as dirname7, join as join4 } from "node:path";
function hasToken(file) {
  return Boolean(file?.token && file.userId && file.expiresAt);
}
function createFileAuthStore(stateDir, fileName = AUTH_FILE_NAME) {
  const path = join4(stateDir, fileName);
  const locks = createFileLock({});
  return {
    async read() {
      try {
        const parsed = JSON.parse(await readFile6(path, "utf8"));
        return parsed?.v === 2 ? parsed : null;
      } catch (error) {
        if (error.code === "ENOENT")
          return null;
        if (error instanceof SyntaxError)
          return null;
        throw error;
      }
    },
    async write(file) {
      await mkdir3(dirname7(path), { recursive: true, mode: 448 });
      await chmod2(dirname7(path), 448);
      await durableWrite(path, `${JSON.stringify(file, null, 2)}
`);
      await chmod2(path, 384);
    },
    withLock: (fn) => locks.withFileLock(path, fn),
    describe: () => path
  };
}
var AUTH_FILE_NAME = "zest2-auth.json";
var init_store = __esm(() => {
  init_persistence();
  init_file_lock();
  init_legacy();
});

// ../../packages/plugin-common/src/auth/auth.ts
function createAuth(config) {
  const { api, store, logger } = config;
  const now = config.now ?? Date.now;
  async function readFile() {
    try {
      return await store.read();
    } catch (error) {
      logger.error("Failed to read Zest 2 credentials", { error, store: store.describe() });
      return null;
    }
  }
  async function agentKey() {
    return await config.agentKey?.() ?? null;
  }
  async function legacyLogin() {
    try {
      return await config.legacy?.() ?? null;
    } catch (error) {
      logger.warn("Could not read the old login", error);
      return null;
    }
  }
  function usable(file) {
    if (!hasToken(file))
      return false;
    const current = api.apiBase();
    if (!file.apiBase || file.apiBase === current)
      return true;
    return OFFICIAL_API_BASES.includes(file.apiBase) && OFFICIAL_API_BASES.includes(current);
  }
  function legacyBlocked(file) {
    if (!isTrustedApiBase(api.apiBase()))
      return true;
    const legacy = file?.legacy;
    if (!legacy)
      return Boolean(file?.signedOutAt);
    if (legacy.outcome === "not_migrated")
      return (legacy.retryAt ?? 0) > now();
    return true;
  }
  function toAuth(token, expiresAt, user) {
    return {
      token,
      expiresAt: typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt),
      userId: "userId" in user ? user.userId : user.id,
      email: user.email ?? "",
      clientId: api.clientId,
      apiBase: api.apiBase()
    };
  }
  async function exchangeLegacy() {
    return store.withLock(async () => {
      const file = await readFile();
      if (usable(file))
        return file;
      if (legacyBlocked(file))
        return null;
      const legacy = await legacyLogin();
      if (!legacy)
        return null;
      const at = now();
      try {
        const { data } = await api.request("/api/v1/auth/legacy", {
          body: {
            access_token: legacy.accessToken,
            client_id: api.clientId,
            ...legacy.workspaceId ? { workspace_id: legacy.workspaceId } : {}
          },
          timeoutMs: 1e4
        });
        const auth = {
          v: 2,
          ...toAuth(data.token, data.expires_at, data.user),
          workspaceId: data.workspace?.id,
          workspaceName: data.workspace?.name
        };
        await store.write({ ...auth, legacy: { outcome: "exchanged", at } });
        logger.info("Exchanged the old login for a Zest 2 token", { userId: auth.userId });
        return auth;
      } catch (error) {
        if (!(error instanceof ApiError))
          throw error;
        if (error.status === 404 && error.code === "user_not_migrated") {
          const retryAt = at + (error.retryAfterS ? error.retryAfterS * 1000 : NOT_MIGRATED_RETRY_MS);
          await store.write({ v: 2, legacy: { outcome: "not_migrated", at, retryAt } });
          logger.info("Account not migrated to Zest 2 yet; queuing until it is", { retryAt });
          return null;
        }
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          await store.write({ v: 2, legacy: { outcome: "rejected", at } });
          logger.info("Old login not exchangeable; sign in again", {
            status: error.status,
            code: error.code
          });
          return null;
        }
        logger.warn("Legacy exchange failed; will retry", {
          status: error.status,
          code: error.code
        });
        return null;
      }
    });
  }
  async function refresh(force = false) {
    const file = await readFile();
    if (!usable(file))
      return null;
    const due = file.expiresAt - now() < REFRESH_WITHIN_MS && now() - (file.refreshedAt ?? 0) > DAY_MS;
    if (!force && !due)
      return file;
    try {
      const { data } = await api.request("/api/v1/auth/refresh", {
        method: "POST",
        credential: { token: file.token }
      });
      return await store.withLock(async () => {
        const current = await readFile();
        if (!usable(current) || current.token !== file.token)
          return current;
        const next = { ...current, expiresAt: Date.parse(data.expires_at), refreshedAt: now() };
        await store.write(next);
        return next;
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await invalidate("refresh_401");
        return null;
      }
      logger.warn("Token refresh failed", error);
      return file;
    }
  }
  async function rejectedByServer(token) {
    try {
      await api.request("/api/v1/plugin/config", { credential: { token }, timeoutMs: 1e4 });
      return false;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        return true;
      logger.warn("Could not confirm the 401; keeping the token", error);
      return false;
    }
  }
  async function invalidate(reason, options = {}) {
    const file = await readFile();
    if (!usable(file))
      return;
    if (!options.confirmed && !await rejectedByServer(file.token)) {
      logger.warn("A 401 was not confirmed by /plugin/config; keeping the token", { reason });
      return;
    }
    await store.withLock(async () => {
      const current = await readFile();
      if (!usable(current) || current.token !== file.token)
        return;
      await store.write({
        v: 2,
        legacy: current.legacy ?? { outcome: "rejected", at: now() },
        signedOutAt: now()
      });
      logger.warn("Zest 2 token rejected; sign in again", { reason });
    });
  }
  async function identity() {
    const file = await readFile();
    if (usable(file)) {
      const { userId, email, workspaceId, workspaceName } = file;
      return { userId, email, workspaceId, workspaceName, source: "zest2" };
    }
    const agent = await agentKey();
    if (agent) {
      return { userId: agent.agentId, email: "", workspaceId: agent.workspaceId, source: "agent" };
    }
    if (file?.signedOutAt)
      return null;
    const legacy = await legacyLogin();
    if (!legacy)
      return null;
    const { userId, email, workspaceId, workspaceName } = legacy;
    return { userId, email, workspaceId, workspaceName, source: "legacy" };
  }
  async function get() {
    const agent = await agentKey();
    if (agent) {
      return {
        credential: { apiKey: agent.apiKey },
        userId: agent.agentId,
        email: "",
        workspaceId: agent.workspaceId,
        source: "agent"
      };
    }
    let auth = await readFile().then((f) => usable(f) ? f : null);
    auth = auth ? await refresh() : await exchangeLegacy();
    if (!auth)
      return null;
    return {
      credential: { token: auth.token },
      userId: auth.userId,
      email: auth.email,
      workspaceId: auth.workspaceId,
      workspaceName: auth.workspaceName,
      source: "zest2"
    };
  }
  async function state() {
    const agent = await agentKey();
    if (agent)
      return { status: "agent", agentId: agent.agentId };
    const file = await readFile();
    if (usable(file))
      return { status: "signed_in", auth: file };
    if (file?.legacy?.outcome === "not_migrated" && (file.legacy.retryAt ?? 0) > now()) {
      return { status: "awaiting_migration", retryAt: file.legacy.retryAt ?? 0 };
    }
    if (!legacyBlocked(file) && await legacyLogin())
      return { status: "pending_exchange" };
    return { status: "signed_out" };
  }
  async function describeToken(token) {
    const { data } = await api.request("/api/v1/plugin/config", {
      credential: { token }
    });
    return {
      v: 2,
      ...toAuth(token, data.token_expires_at ?? new Date(now() + 60 * DAY_MS).toISOString(), data.user),
      workspaceId: data.workspace?.id,
      workspaceName: data.workspace?.name,
      refreshedAt: now()
    };
  }
  async function adopt(token) {
    const auth = await describeToken(token);
    await store.withLock(async () => {
      const previous = await readFile();
      await store.write({ ...auth, legacy: previous?.legacy });
    });
    return auth;
  }
  async function login(options = {}) {
    const token = await runDeviceLogin({
      api,
      logger,
      openBrowser: config.openBrowser,
      print: options.print,
      onDeviceCode: options.onDeviceCode,
      signal: options.signal
    });
    return adopt(token);
  }
  async function logout() {
    const file = await readFile();
    let ended = !usable(file);
    if (usable(file)) {
      try {
        await api.request("/api/auth/sign-out", {
          method: "POST",
          body: {},
          credential: { token: file.token },
          timeoutMs: SIGN_OUT_DEADLINE_MS
        });
        ended = true;
      } catch (error) {
        ended = error instanceof ApiError && error.status === 401;
        if (!ended)
          logger.warn("Sign-out could not be confirmed", error);
      }
    }
    await store.withLock(async () => {
      const current = await readFile();
      await store.write({
        v: 2,
        legacy: current?.legacy ?? { outcome: "rejected", at: now() },
        signedOutAt: now()
      });
    });
    return ended;
  }
  async function switchWorkspace(workspaceId) {
    const active = await get();
    if (!active)
      throw new ApiError(401, "not_signed_in", "Not signed in");
    const { data } = await api.request("/api/v1/auth/workspace", {
      body: { workspace_id: workspaceId },
      credential: active.credential
    });
    await rememberWorkspace(data.workspace);
    return data.workspace;
  }
  async function rememberWorkspace(workspace) {
    if (!workspace)
      return;
    await store.withLock(async () => {
      const file = await readFile();
      if (!usable(file))
        return;
      if (file.workspaceId === workspace.id && file.workspaceName === workspace.name)
        return;
      await store.write({ ...file, workspaceId: workspace.id, workspaceName: workspace.name });
    });
  }
  return {
    identity,
    get,
    state,
    login,
    adopt,
    logout,
    refresh,
    invalidate,
    switchWorkspace,
    rememberWorkspace
  };
}
var DAY_MS, REFRESH_WITHIN_MS, NOT_MIGRATED_RETRY_MS, SIGN_OUT_DEADLINE_MS = 1e4;
var init_auth = __esm(() => {
  init_base();
  init_client();
  init_device_login();
  init_store();
  DAY_MS = 24 * 60 * 60 * 1000;
  REFRESH_WITHIN_MS = 30 * DAY_MS;
  NOT_MIGRATED_RETRY_MS = 5 * 60 * 1000;
});

// ../../packages/plugin-common/src/zest.ts
import { readFile as readFile7 } from "node:fs/promises";
import { join as join5 } from "node:path";
function createZestClient(options) {
  const { logger, stateDir } = options;
  if (!options.store && !stateDir)
    throw new Error("createZestClient needs stateDir or store");
  if (stateDir) {
    secureDirectory(stateDir).catch((error) => logger.warn("Could not make the state folder private", { stateDir, error }));
  }
  const api = createApiClient({
    clientId: options.clientId,
    version: options.version,
    apiBase: options.apiBase,
    fetch: options.fetch
  });
  const store = options.store ?? createFileAuthStore(stateDir);
  const legacy = options.legacy ?? (stateDir ? () => readLegacySessionFile(join5(stateDir, "session.json")) : undefined);
  const auth = createAuth({
    api,
    store,
    logger,
    legacy,
    agentKey: options.agentKey,
    openBrowser: options.openBrowser
  });
  const cacheFile = stateDir ? join5(stateDir, CONFIG_CACHE_FILE) : null;
  let memoryCache = null;
  const webUrl = (path = "") => `${api.apiBase()}${path}`;
  async function readCache() {
    if (memoryCache)
      return memoryCache;
    if (!cacheFile)
      return null;
    try {
      return JSON.parse(await readFile7(cacheFile, "utf8"));
    } catch (error) {
      logger.debug("Plugin config cache missing or unreadable", error);
      return null;
    }
  }
  async function writeCache(entry) {
    memoryCache = entry;
    if (!cacheFile)
      return;
    try {
      await durableWrite(cacheFile, JSON.stringify(entry));
    } catch (error) {
      logger.warn("Could not cache plugin config", error);
    }
  }
  async function config({ force = false } = {}) {
    const active = await auth.get();
    if (!active)
      return null;
    const cached = await readCache();
    const fresh = cached && cached.userId === active.userId && cached.apiBase === api.apiBase() && Date.now() - cached.fetchedAt < PLUGIN_CONFIG_TTL_MS;
    if (fresh && !force)
      return cached.config;
    try {
      const { data } = await api.request("/api/v1/plugin/config", {
        credential: active.credential
      });
      await writeCache({
        fetchedAt: Date.now(),
        userId: active.userId,
        apiBase: api.apiBase(),
        config: data
      });
      if (active.source === "zest2")
        await auth.rememberWorkspace(data.workspace);
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && active.source === "zest2") {
        await auth.invalidate("config_401", { confirmed: true });
        return null;
      }
      logger.warn("Could not read plugin config", error);
      return cached && cached.userId === active.userId ? cached.config : null;
    }
  }
  async function version() {
    try {
      const query = new URLSearchParams({ client: api.clientId, version: options.version() });
      const { data } = await api.request(`/api/v1/plugin/version?${query}`, {
        timeoutMs: 5000
      });
      return data;
    } catch (error) {
      logger.warn("Version check failed", error);
      return null;
    }
  }
  async function ingest(batch, opts = {}) {
    const credential = opts.credential ?? (await auth.get())?.credential;
    if (!credential)
      throw new ApiError(401, "not_signed_in", "Not signed in");
    const { data } = await api.request("/api/v1/ingest", {
      body: batch,
      gzip: true,
      credential,
      timeoutMs: INGEST_TIMEOUT_MS,
      headers: {
        "idempotency-key": batch.batch_id,
        ...opts.workspaceId ? { "x-zest-workspace": opts.workspaceId } : {}
      }
    });
    return data;
  }
  async function generateStandup(day) {
    const active = await auth.get();
    if (!active)
      throw new ApiError(401, "not_signed_in", "Not signed in");
    const url = webUrl("/app");
    try {
      const { data } = await api.request("/api/v1/standup", {
        body: day ? { day } : {},
        credential: active.credential,
        timeoutMs: 130000
      });
      return { status: data?.status ?? "generating", url: data?.url ?? url };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return { status: "already_generating", url };
      }
      throw error;
    }
  }
  async function standupSince(since) {
    const active = await auth.get();
    if (!active)
      return null;
    const query = new URLSearchParams({ since: since.toISOString() });
    const { data } = await api.request(`/api/v1/standup?${query}`, { credential: active.credential });
    const id = data?.standup?.id ?? data?.id;
    return id ? { id, url: webUrl("/app") } : null;
  }
  return {
    clientId: options.clientId,
    api,
    auth,
    logger,
    apiBase: api.apiBase,
    webUrl,
    config,
    version,
    ingest,
    generateStandup,
    standupSince
  };
}
var PLUGIN_CONFIG_TTL_MS, CONFIG_CACHE_FILE = "plugin-config.json", INGEST_TIMEOUT_MS = 60000;
var init_zest = __esm(() => {
  init_client();
  init_auth();
  init_legacy();
  init_store();
  init_persistence();
  init_fs_utils();
  PLUGIN_CONFIG_TTL_MS = 5 * 60 * 1000;
});

// ../../packages/plugin-common/src/runtime/runtime-env.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { mkdir as mkdir4, readFile as readFile8, writeFile as writeFile5 } from "node:fs/promises";
import { dirname as dirname8 } from "node:path";
function dotenvLine(key, value) {
  return `${key}="${value.replaceAll("\\", "\\\\").replaceAll('"', "\\\"")}"`;
}
function parseRuntimeEnvFile(body) {
  const raw = {};
  for (const key of SNAPSHOT_ENV_KEYS) {
    const match = body.match(new RegExp(`^${key}="([^"]*)"`, "m"));
    if (match?.[1])
      raw[key] = match[1];
  }
  return raw;
}
function createRuntimeEnv(config) {
  const { file } = config;
  async function readRuntimeEnvSnapshot() {
    try {
      return parseRuntimeEnvFile(await readFile8(file, "utf-8"));
    } catch (error) {
      logHandled("runtime env snapshot missing or unreadable; using the build's API base", error);
      return null;
    }
  }
  function loadRuntimeEnvIntoProcess() {
    try {
      const parsed = parseRuntimeEnvFile(readFileSync2(file, "utf-8"));
      for (const key of SNAPSHOT_ENV_KEYS) {
        const value = parsed[key];
        if (value && !process.env[key])
          process.env[key] = value;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn(`Zest: could not read ${file}`, error);
      }
    }
  }
  async function snapshotRuntimeEnv() {
    let previous = "";
    try {
      previous = await readFile8(file, "utf-8");
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
    }
    const kept = previous.split(`
`).filter((line) => line && !SNAPSHOT_ENV_KEYS.some((key) => line.startsWith(`${key}=`)));
    const added = SNAPSHOT_ENV_KEYS.flatMap((key) => {
      const value = process.env[key];
      return value ? [dotenvLine(key, value)] : [];
    });
    if (added.length === 0 && kept.length === 0)
      return null;
    const body = `${[...kept, ...added].join(`
`)}
`;
    if (body !== previous) {
      await mkdir4(dirname8(file), { recursive: true, mode: 448 });
      await writeFile5(file, body, { encoding: "utf-8", mode: 384 });
    }
    return added.length > 0 ? file : null;
  }
  return { readRuntimeEnvSnapshot, loadRuntimeEnvIntoProcess, snapshotRuntimeEnv };
}
var SNAPSHOT_ENV_KEYS;
var init_runtime_env = __esm(() => {
  SNAPSHOT_ENV_KEYS = ["ZEST_API_URL"];
});

// ../../packages/plugin-common/src/analytics/anonymous-id.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdirSync, readFileSync as readFileSync3, writeFileSync } from "node:fs";
import { join as join6 } from "node:path";
function getProcessFallbackId() {
  processFallbackId ??= randomUUID2();
  return processFallbackId;
}
function getAnonymousId(stateDir) {
  const cached = cachedIds.get(stateDir);
  if (cached)
    return cached;
  const idFile = join6(stateDir, ANONYMOUS_ID_FILE);
  try {
    const existing = readFileSync3(idFile, "utf8").trim();
    if (existing) {
      cachedIds.set(stateDir, existing);
      return existing;
    }
  } catch (error) {
    logHandled("anonymous id file missing or unreadable; minting a new one", error);
  }
  const id = randomUUID2();
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(idFile, id, { encoding: "utf8", mode: 384, flag: "wx" });
    cachedIds.set(stateDir, id);
    return id;
  } catch (error) {
    if (error?.code === "EEXIST") {
      try {
        const winner = readFileSync3(idFile, "utf8").trim();
        if (winner) {
          cachedIds.set(stateDir, winner);
          return winner;
        }
        writeFileSync(idFile, id, { encoding: "utf8", mode: 384 });
        cachedIds.set(stateDir, id);
        return id;
      } catch (readError) {
        logHandled("anonymous id file unusable after EEXIST; using the in-memory id", readError);
      }
    }
    return getProcessFallbackId();
  }
}
var ANONYMOUS_ID_FILE = "anon-id", cachedIds, processFallbackId;
var init_anonymous_id = __esm(() => {
  cachedIds = new Map;
});

// ../../packages/analytics/src/plugin/client.ts
class Analytics {
  providers;
  defaultContext = {};
  constructor(providers) {
    this.providers = providers;
  }
  setContext(properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) {
        delete this.defaultContext[key];
      } else {
        this.defaultContext[key] = value;
      }
    }
  }
  set(collection, objectId, properties) {
    for (const provider of this.providers) {
      try {
        provider.set(collection, objectId, properties);
      } catch (e) {
        if (isDevelopment()) {
          console.warn("[analytics] provider.set() failed:", e);
        }
      }
    }
  }
  event(collection, objectId, eventName, properties, context) {
    const ambient = { ...this.defaultContext };
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined)
        delete ambient[key];
    }
    const mergedContext = { ...ambient, ...context };
    for (const provider of this.providers) {
      try {
        provider.event(collection, objectId, eventName, properties, mergedContext);
      } catch (e) {
        if (isDevelopment()) {
          console.warn("[analytics] provider.event() failed:", e);
        }
      }
    }
  }
  captureException(error, distinctId, context) {
    for (const provider of this.providers) {
      try {
        provider.captureException?.(error, distinctId, context);
      } catch (e) {
        if (isDevelopment()) {
          console.warn("[analytics] provider.captureException() failed:", e);
        }
      }
    }
  }
  async getFeatureFlag(key, distinctId) {
    for (const provider of this.providers) {
      const value = await provider.getFeatureFlag?.(key, distinctId);
      if (value !== undefined)
        return value;
    }
    return;
  }
  reset() {
    this.defaultContext = {};
    for (const provider of this.providers) {
      try {
        provider.reset?.();
      } catch (e) {
        if (isDevelopment()) {
          console.warn("[analytics] provider.reset() failed:", e);
        }
      }
    }
  }
  track(params) {
    this.event("users", params.distinctId, params.event, params.properties);
  }
  identify(userId, properties) {
    this.set("users", userId, properties ?? {});
  }
  async dispose() {
    await Promise.allSettled(this.providers.map((p) => {
      try {
        return p.dispose?.();
      } catch {
        return;
      }
    }));
  }
}
var isDevelopment = () => globalThis.process?.env.NODE_ENV === "development";

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/error-tracking/modifiers/module.node.mjs
import { dirname as dirname9, posix, sep } from "path";
function createModulerModifier() {
  const getModuleFromFileName = createGetModuleFromFilename();
  return async (frames) => {
    for (const frame of frames)
      frame.module = getModuleFromFileName(frame.filename);
    return frames;
  };
}
function createGetModuleFromFilename(basePath = process.argv[1] ? dirname9(process.argv[1]) : process.cwd(), isWindows = sep === "\\") {
  const normalizedBase = isWindows ? normalizeWindowsPath(basePath) : basePath;
  return (filename) => {
    if (!filename)
      return;
    const normalizedFilename = isWindows ? normalizeWindowsPath(filename) : filename;
    let { dir, base: file, ext } = posix.parse(normalizedFilename);
    if (ext === ".js" || ext === ".mjs" || ext === ".cjs")
      file = file.slice(0, -1 * ext.length);
    const decodedFile = decodeURIComponent(file);
    if (!dir)
      dir = ".";
    const n = dir.lastIndexOf("/node_modules");
    if (n > -1)
      return `${dir.slice(n + 14).replace(/\//g, ".")}:${decodedFile}`;
    if (dir.startsWith(normalizedBase)) {
      const moduleName = dir.slice(normalizedBase.length + 1).replace(/\//g, ".");
      return moduleName ? `${moduleName}:${decodedFile}` : decodedFile;
    }
    return decodedFile;
  };
}
function normalizeWindowsPath(path) {
  return path.replace(/^[A-Z]:/, "").replace(/\\/g, "/");
}
var init_module_node = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/types.mjs
var types_PostHogPersistedProperty;
var init_types = __esm(() => {
  types_PostHogPersistedProperty = /* @__PURE__ */ function(PostHogPersistedProperty) {
    PostHogPersistedProperty["AnonymousId"] = "anonymous_id";
    PostHogPersistedProperty["DistinctId"] = "distinct_id";
    PostHogPersistedProperty["Props"] = "props";
    PostHogPersistedProperty["EnablePersonProcessing"] = "enable_person_processing";
    PostHogPersistedProperty["PersonMode"] = "person_mode";
    PostHogPersistedProperty["FeatureFlagDetails"] = "feature_flag_details";
    PostHogPersistedProperty["FeatureFlags"] = "feature_flags";
    PostHogPersistedProperty["FeatureFlagPayloads"] = "feature_flag_payloads";
    PostHogPersistedProperty["BootstrapFeatureFlagDetails"] = "bootstrap_feature_flag_details";
    PostHogPersistedProperty["BootstrapFeatureFlags"] = "bootstrap_feature_flags";
    PostHogPersistedProperty["BootstrapFeatureFlagPayloads"] = "bootstrap_feature_flag_payloads";
    PostHogPersistedProperty["OverrideFeatureFlags"] = "override_feature_flags";
    PostHogPersistedProperty["Queue"] = "queue";
    PostHogPersistedProperty["AiQueue"] = "ai_queue";
    PostHogPersistedProperty["AiCaptureQueue"] = "ai_capture_queue";
    PostHogPersistedProperty["LogsQueue"] = "logs_queue";
    PostHogPersistedProperty["OptedOut"] = "opted_out";
    PostHogPersistedProperty["SessionId"] = "session_id";
    PostHogPersistedProperty["SessionStartTimestamp"] = "session_start_timestamp";
    PostHogPersistedProperty["SessionLastTimestamp"] = "session_timestamp";
    PostHogPersistedProperty["PersonProperties"] = "person_properties";
    PostHogPersistedProperty["GroupProperties"] = "group_properties";
    PostHogPersistedProperty["InstalledAppBuild"] = "installed_app_build";
    PostHogPersistedProperty["InstalledAppVersion"] = "installed_app_version";
    PostHogPersistedProperty["SessionReplay"] = "session_replay";
    PostHogPersistedProperty["PushRegistered"] = "push_registered";
    PostHogPersistedProperty["SessionReplayEventTriggerActivatedSession"] = "session_replay_event_trigger_activated_session";
    PostHogPersistedProperty["SurveyLastSeenDate"] = "survey_last_seen_date";
    PostHogPersistedProperty["SurveysInProgress"] = "surveys_in_progress";
    PostHogPersistedProperty["SurveysSeen"] = "surveys_seen";
    PostHogPersistedProperty["Surveys"] = "surveys";
    PostHogPersistedProperty["RemoteConfig"] = "remote_config";
    PostHogPersistedProperty["FlagsEndpointWasHit"] = "flags_endpoint_was_hit";
    PostHogPersistedProperty["DeviceId"] = "device_id";
    return PostHogPersistedProperty;
  }({});
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/string-utils.mjs
function safeJsonStringify(value) {
  const ancestors = [];
  return JSON.stringify(value, function(_key, replacementValue) {
    if (typeof replacementValue == "bigint")
      return replacementValue.toString();
    if (typeof replacementValue == "function" || typeof replacementValue == "symbol")
      return;
    if (replacementValue instanceof Error)
      return {
        name: replacementValue.name,
        message: replacementValue.message,
        stack: replacementValue.stack
      };
    if (replacementValue && typeof replacementValue == "object") {
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this)
        ancestors.pop();
      if (ancestors.includes(replacementValue))
        return "[Circular]";
      ancestors.push(replacementValue);
    }
    return replacementValue;
  }) ?? "null";
}
var init_string_utils = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/type-utils.mjs
function isPrimitive(value) {
  return value === null || typeof value != "object";
}
function isBuiltin(candidate, className) {
  return Object.prototype.toString.call(candidate) === `[object ${className}]`;
}
function isError(candidate) {
  switch (Object.prototype.toString.call(candidate)) {
    case "[object Error]":
    case "[object Exception]":
    case "[object DOMException]":
    case "[object DOMError]":
    case "[object WebAssembly.Exception]":
      return true;
    default:
      return isInstanceOf(candidate, Error);
  }
}
function isEvent(candidate) {
  return "u" > typeof Event && isInstanceOf(candidate, Event);
}
function isPlainObject2(candidate) {
  return isBuiltin(candidate, "Object");
}
function isInstanceOf(candidate, base) {
  try {
    return candidate instanceof base;
  } catch {
    return false;
  }
}
var nativeIsArray, ObjProto, type_utils_hasOwnProperty, type_utils_toString, isArray, isObject2 = (x) => x === Object(x) && !isArray(x), isUndefined = (x) => x === undefined, isString = (x) => type_utils_toString.call(x) == "[object String]", isEmptyString = (x) => isString(x) && x.trim().length === 0, isNull = (x) => x === null, isNullish = (x) => isUndefined(x) || isNull(x), isNumber = (x) => type_utils_toString.call(x) == "[object Number]" && x === x, isBoolean = (x) => type_utils_toString.call(x) === "[object Boolean]";
var init_type_utils = __esm(() => {
  init_types();
  init_string_utils();
  nativeIsArray = Array.isArray;
  ObjProto = Object.prototype;
  type_utils_hasOwnProperty = ObjProto.hasOwnProperty;
  type_utils_toString = ObjProto.toString;
  isArray = nativeIsArray || function(obj) {
    return type_utils_toString.call(obj) === "[object Array]";
  };
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/bot-detection.mjs
function buildCacheKey(ua, custom) {
  let customEncoded = "";
  for (let i = 0;i < custom.length; i++) {
    const c = custom[i];
    customEncoded += c.length + ":" + c;
  }
  return ua.length + ":" + ua + "|" + custom.length + ":" + customEncoded;
}
var DEFAULT_BLOCKED_UA_STRS, UA_CACHE, MAX_CACHE_ENTRIES = 256, isBlockedUA = function(ua, customBlockedUserAgents = []) {
  if (!ua)
    return false;
  const key = buildCacheKey(ua, customBlockedUserAgents);
  const cached = UA_CACHE.get(key);
  if (cached !== undefined)
    return cached;
  const uaLower = ua.toLowerCase();
  const result = DEFAULT_BLOCKED_UA_STRS.concat(customBlockedUserAgents).some((blockedUA) => uaLower.indexOf(blockedUA.toLowerCase()) !== -1);
  if (UA_CACHE.size >= MAX_CACHE_ENTRIES)
    UA_CACHE.clear();
  UA_CACHE.set(key, result);
  return result;
};
var init_bot_detection = __esm(() => {
  DEFAULT_BLOCKED_UA_STRS = [
    "amazonbot",
    "amazonproductbot",
    "app.hypefactors.com",
    "applebot",
    "archive.org_bot",
    "awariobot",
    "backlinksextendedbot",
    "baiduspider",
    "bingbot",
    "bingpreview",
    "chrome-lighthouse",
    "dataforseobot",
    "deepscan",
    "duckduckbot",
    "facebookexternal",
    "facebookcatalog",
    "http://yandex.com/bots",
    "hubspot",
    "ia_archiver",
    "leikibot",
    "linkedinbot",
    "meta-externalagent",
    "mj12bot",
    "msnbot",
    "nessus",
    "petalbot",
    "pinterestbot",
    "prerender",
    "rogerbot",
    "screaming frog",
    "sebot-wa",
    "sitebulb",
    "slackbot",
    "slurp",
    "trendictionbot",
    "turnitin",
    "twitterbot",
    "vercel-screenshot",
    "vercelbot",
    "yahoo! slurp",
    "yandexbot",
    "zoombot",
    "bot.htm",
    "bot.php",
    "(bot;",
    "bot/",
    "crawler",
    "ahrefsbot",
    "ahrefssiteaudit",
    "semrushbot",
    "siteauditbot",
    "splitsignalbot",
    "gptbot",
    "oai-searchbot",
    "chatgpt-user",
    "perplexitybot",
    "better uptime bot",
    "sentryuptimebot",
    "uptimerobot",
    "headlesschrome",
    "lightpanda",
    "cypress",
    "google-hoteladsverifier",
    "adsbot-google",
    "apis-google",
    "duplexweb-google",
    "feedfetcher-google",
    "google favicon",
    "google web preview",
    "google-read-aloud",
    "googlebot",
    "googleother",
    "google-cloudvertexbot",
    "googleweblight",
    "mediapartners-google",
    "storebot-google",
    "google-inspectiontool",
    "bytespider"
  ];
  UA_CACHE = new Map;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/browser-utils.mjs
var init_browser_utils = __esm(() => {
  init_string_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/number-utils.mjs
function clampToRange(value, min, max, logger, fallbackValue) {
  if (min > max) {
    logger.warn("min cannot be greater than max.");
    min = max;
  }
  if (isNumber(value))
    if (value > max) {
      logger.warn(" cannot be  greater than max: " + max + ". Using max value instead.");
      return max;
    } else {
      if (!(value < min))
        return value;
      logger.warn(" cannot be less than min: " + min + ". Using min value instead.");
      return min;
    }
  logger.warn(" must be a number. using max or fallback. max: " + max + ", fallback: " + fallbackValue);
  return clampToRange(fallbackValue ?? max, min, max, logger);
}
var init_number_utils = __esm(() => {
  init_type_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/bucketed-rate-limiter.mjs
function resolveExceptionRateLimiterConfig(config = {}) {
  return {
    refillRate: config.exceptionRateLimiterRefillRate ?? config.__exceptionRateLimiterRefillRate ?? DEFAULT_EXCEPTION_RATE_LIMITER_REFILL_RATE,
    bucketSize: config.exceptionRateLimiterBucketSize ?? config.__exceptionRateLimiterBucketSize ?? DEFAULT_EXCEPTION_RATE_LIMITER_BUCKET_SIZE
  };
}

class BucketedRateLimiter {
  constructor(options) {
    this._buckets = {};
    this._onBucketRateLimited = options._onBucketRateLimited;
    this._bucketSize = clampToRange(options.bucketSize, 0, 100, options._logger);
    this._refillRate = clampToRange(options.refillRate, 0, this._bucketSize, options._logger);
    this._refillInterval = clampToRange(options.refillInterval, 0, ONE_DAY_IN_MS, options._logger);
  }
  _applyRefill(bucket, now) {
    const elapsedMs = now - bucket.lastAccess;
    const refillIntervals = Math.floor(elapsedMs / this._refillInterval);
    if (refillIntervals > 0) {
      const tokensToAdd = refillIntervals * this._refillRate;
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this._bucketSize);
      bucket.lastAccess = bucket.lastAccess + refillIntervals * this._refillInterval;
    }
  }
  consumeRateLimit(key) {
    const now = Date.now();
    const keyStr = String(key);
    let bucket = this._buckets[keyStr];
    if (bucket)
      this._applyRefill(bucket, now);
    else {
      bucket = {
        tokens: this._bucketSize,
        lastAccess: now
      };
      this._buckets[keyStr] = bucket;
    }
    if (bucket.tokens === 0)
      return true;
    bucket.tokens--;
    if (bucket.tokens === 0)
      this._onBucketRateLimited?.(key);
    return bucket.tokens === 0;
  }
  stop() {
    this._buckets = {};
  }
}
var ONE_DAY_IN_MS = 86400000, DEFAULT_EXCEPTION_RATE_LIMITER_REFILL_RATE = 1, DEFAULT_EXCEPTION_RATE_LIMITER_BUCKET_SIZE = 10;
var init_bucketed_rate_limiter = __esm(() => {
  init_number_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/vendor/uuidv7.mjs
class UUID {
  constructor(bytes) {
    this.bytes = bytes;
  }
  static ofInner(bytes) {
    if (bytes.length === 16)
      return new UUID(bytes);
    throw new TypeError("not 128-bit length");
  }
  static fromFieldsV7(unixTsMs, randA, randBHi, randBLo) {
    if (!Number.isInteger(unixTsMs) || !Number.isInteger(randA) || !Number.isInteger(randBHi) || !Number.isInteger(randBLo) || unixTsMs < 0 || randA < 0 || randBHi < 0 || randBLo < 0 || unixTsMs > 281474976710655 || randA > 4095 || randBHi > 1073741823 || randBLo > 4294967295)
      throw new RangeError("invalid field value");
    const bytes = new Uint8Array(16);
    bytes[0] = unixTsMs / 2 ** 40;
    bytes[1] = unixTsMs / 2 ** 32;
    bytes[2] = unixTsMs / 2 ** 24;
    bytes[3] = unixTsMs / 2 ** 16;
    bytes[4] = unixTsMs / 256;
    bytes[5] = unixTsMs;
    bytes[6] = 112 | randA >>> 8;
    bytes[7] = randA;
    bytes[8] = 128 | randBHi >>> 24;
    bytes[9] = randBHi >>> 16;
    bytes[10] = randBHi >>> 8;
    bytes[11] = randBHi;
    bytes[12] = randBLo >>> 24;
    bytes[13] = randBLo >>> 16;
    bytes[14] = randBLo >>> 8;
    bytes[15] = randBLo;
    return new UUID(bytes);
  }
  static parse(uuid) {
    let hex;
    switch (uuid.length) {
      case 32:
        hex = /^[0-9a-f]{32}$/i.exec(uuid)?.[0];
        break;
      case 36:
        hex = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(uuid)?.slice(1, 6).join("");
        break;
      case 38:
        hex = /^\{([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\}$/i.exec(uuid)?.slice(1, 6).join("");
        break;
      case 45:
        hex = /^urn:uuid:([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(uuid)?.slice(1, 6).join("");
        break;
      default:
        break;
    }
    if (hex) {
      const inner = new Uint8Array(16);
      for (let i = 0;i < 16; i += 4) {
        const n = parseInt(hex.substring(2 * i, 2 * i + 8), 16);
        inner[i + 0] = n >>> 24;
        inner[i + 1] = n >>> 16;
        inner[i + 2] = n >>> 8;
        inner[i + 3] = n;
      }
      return new UUID(inner);
    }
    throw new SyntaxError("could not parse UUID string");
  }
  toString() {
    let text = "";
    for (let i = 0;i < this.bytes.length; i++) {
      text += DIGITS.charAt(this.bytes[i] >>> 4);
      text += DIGITS.charAt(15 & this.bytes[i]);
      if (i === 3 || i === 5 || i === 7 || i === 9)
        text += "-";
    }
    return text;
  }
  toHex() {
    let text = "";
    for (let i = 0;i < this.bytes.length; i++) {
      text += DIGITS.charAt(this.bytes[i] >>> 4);
      text += DIGITS.charAt(15 & this.bytes[i]);
    }
    return text;
  }
  toJSON() {
    return this.toString();
  }
  getVariant() {
    const n = this.bytes[8] >>> 4;
    if (n < 0)
      throw new Error("unreachable");
    if (n <= 7)
      return this.bytes.every((e) => e === 0) ? "NIL" : "VAR_0";
    if (n <= 11)
      return "VAR_10";
    if (n <= 13)
      return "VAR_110";
    if (n <= 15)
      return this.bytes.every((e) => e === 255) ? "MAX" : "VAR_RESERVED";
    else
      throw new Error("unreachable");
  }
  getVersion() {
    return this.getVariant() === "VAR_10" ? this.bytes[6] >>> 4 : undefined;
  }
  clone() {
    return new UUID(this.bytes.slice(0));
  }
  equals(other) {
    return this.compareTo(other) === 0;
  }
  compareTo(other) {
    for (let i = 0;i < 16; i++) {
      const diff = this.bytes[i] - other.bytes[i];
      if (diff !== 0)
        return Math.sign(diff);
    }
    return 0;
  }
}

class V7Generator {
  constructor(randomNumberGenerator) {
    this.timestamp = 0;
    this.counter = 0;
    this.random = randomNumberGenerator ?? getDefaultRandom();
  }
  generate() {
    return this.generateOrResetCore(Date.now(), 1e4);
  }
  generateOrAbort() {
    return this.generateOrAbortCore(Date.now(), 1e4);
  }
  generateOrResetCore(unixTsMs, rollbackAllowance) {
    let value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
    if (value === undefined) {
      this.timestamp = 0;
      value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
    }
    return value;
  }
  generateOrAbortCore(unixTsMs, rollbackAllowance) {
    const MAX_COUNTER = 4398046511103;
    if (!Number.isInteger(unixTsMs) || unixTsMs < 1 || unixTsMs > 281474976710655)
      throw new RangeError("`unixTsMs` must be a 48-bit positive integer");
    if (rollbackAllowance < 0 || rollbackAllowance > 281474976710655)
      throw new RangeError("`rollbackAllowance` out of reasonable range");
    if (unixTsMs > this.timestamp) {
      this.timestamp = unixTsMs;
      this.resetCounter();
    } else {
      if (!(unixTsMs + rollbackAllowance >= this.timestamp))
        return;
      this.counter++;
      if (this.counter > MAX_COUNTER) {
        this.timestamp++;
        this.resetCounter();
      }
    }
    return UUID.fromFieldsV7(this.timestamp, Math.trunc(this.counter / 2 ** 30), this.counter & 2 ** 30 - 1, this.random.nextUint32());
  }
  resetCounter() {
    this.counter = 1024 * this.random.nextUint32() + (1023 & this.random.nextUint32());
  }
  generateV4() {
    const bytes = new Uint8Array(Uint32Array.of(this.random.nextUint32(), this.random.nextUint32(), this.random.nextUint32(), this.random.nextUint32()).buffer);
    bytes[6] = 64 | bytes[6] >>> 4;
    bytes[8] = 128 | bytes[8] >>> 2;
    return UUID.ofInner(bytes);
  }
}
var DIGITS = "0123456789abcdef", getDefaultRandom = () => ({
  nextUint32: () => 65536 * Math.trunc(65536 * Math.random()) + Math.trunc(65536 * Math.random()) >>> 0
}), defaultGenerator, uuidv7 = () => uuidv7obj().toString(), uuidv7obj = () => (defaultGenerator || (defaultGenerator = new V7Generator)).generate();
var init_uuidv7 = __esm(() => {
  /*! LICENSE: uuidv7.mjs.LICENSE.txt */
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/promise-queue.mjs
class PromiseQueue {
  add(promise) {
    const promiseUUID = uuidv7();
    const id = ++this.nextId;
    this.promiseByIds[promiseUUID] = {
      id,
      promise
    };
    promise.catch(() => {}).finally(() => {
      delete this.promiseByIds[promiseUUID];
    });
    return promise;
  }
  async join() {
    let promises = Object.values(this.promiseByIds).map((item) => item.promise);
    let length = promises.length;
    while (length > 0) {
      await Promise.all(promises);
      promises = Object.values(this.promiseByIds).map((item) => item.promise);
      length = promises.length;
    }
  }
  getPromises(ignoredPromises = [], maxId = this.nextId) {
    const ignoredPromiseSet = new Set(ignoredPromises);
    return Object.values(this.promiseByIds).filter((item) => item.id <= maxId && !ignoredPromiseSet.has(item.promise)).map((item) => item.promise);
  }
  get maxId() {
    return this.nextId;
  }
  get length() {
    return Object.keys(this.promiseByIds).length;
  }
  constructor() {
    this.promiseByIds = {};
    this.nextId = 0;
  }
}
var init_promise_queue = __esm(() => {
  init_uuidv7();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/logger.mjs
function createConsole(consoleLike = console) {
  const lockedMethods = {
    log: consoleLike.log.bind(consoleLike),
    warn: consoleLike.warn.bind(consoleLike),
    error: consoleLike.error.bind(consoleLike),
    debug: consoleLike.debug.bind(consoleLike)
  };
  return lockedMethods;
}
function createLogger2(prefix, maybeCall = passThrough) {
  return _createLogger(prefix, maybeCall, createConsole());
}
var _createLogger = (prefix, maybeCall, consoleLike) => {
  function _log(level, ...args) {
    maybeCall(() => {
      const consoleMethod = consoleLike[level];
      consoleMethod(prefix, ...args);
    });
  }
  const logger = {
    debug: (...args) => {
      _log("debug", ...args);
    },
    info: (...args) => {
      _log("log", ...args);
    },
    warn: (...args) => {
      _log("warn", ...args);
    },
    error: (...args) => {
      _log("error", ...args);
    },
    critical: (...args) => {
      consoleLike["error"](prefix, ...args);
    },
    createLogger: (additionalPrefix) => _createLogger(`${prefix} ${additionalPrefix}`, maybeCall, consoleLike)
  };
  return logger;
}, passThrough = (fn) => fn();
var init_logger2 = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/user-agent-utils.mjs
var MOBILE = "Mobile", IOS = "iOS", ANDROID = "Android", TABLET = "Tablet", ANDROID_TABLET, APPLE = "Apple", APPLE_WATCH, SAFARI = "Safari", BLACKBERRY = "BlackBerry", SAMSUNG = "Samsung", SAMSUNG_BROWSER, SAMSUNG_INTERNET, CHROME = "Chrome", CHROME_OS, CHROME_IOS, INTERNET_EXPLORER = "Internet Explorer", INTERNET_EXPLORER_MOBILE, OPERA = "Opera", OPERA_MINI, EDGE = "Edge", MICROSOFT_EDGE, FIREFOX = "Firefox", FIREFOX_IOS, NINTENDO = "Nintendo", PLAYSTATION = "PlayStation", XBOX = "Xbox", ANDROID_MOBILE, MOBILE_SAFARI, WINDOWS = "Windows", WINDOWS_PHONE, GENERIC = "Generic", GENERIC_MOBILE, GENERIC_TABLET, KONQUEROR = "Konqueror", OCULUS_BROWSER = "Oculus Browser", VIVALDI = "Vivaldi", YANDEX = "Yandex", WHALE = "Whale", DUCKDUCKGO = "DuckDuckGo", PALE_MOON = "Pale Moon", WATERFOX = "Waterfox", BRAVE = "Brave", CLAUDE = "Claude", CODEX = "Codex", CHATGPT = "ChatGPT", GOOGLE_SEARCH_APP = "Google Search App", BROWSER_VERSION_REGEX_SUFFIX = "(\\d+(\\.\\d+)?)", DEFAULT_BROWSER_VERSION_REGEX, AI_APP_VERSION_REGEX, PLAYSTATION_REGEX, NINTENDO_REGEX, BLACKBERRY_REGEX, windowsVersionMap, versionRegexes, osMatchers;
var init_user_agent_utils = __esm(() => {
  init_string_utils();
  init_type_utils();
  ANDROID_TABLET = ANDROID + " " + TABLET;
  APPLE_WATCH = APPLE + " Watch";
  SAMSUNG_BROWSER = SAMSUNG + "Browser";
  SAMSUNG_INTERNET = SAMSUNG + " Internet";
  CHROME_OS = CHROME + " OS";
  CHROME_IOS = CHROME + " " + IOS;
  INTERNET_EXPLORER_MOBILE = INTERNET_EXPLORER + " " + MOBILE;
  OPERA_MINI = OPERA + " Mini";
  MICROSOFT_EDGE = "Microsoft " + EDGE;
  FIREFOX_IOS = FIREFOX + " " + IOS;
  ANDROID_MOBILE = ANDROID + " " + MOBILE;
  MOBILE_SAFARI = MOBILE + " " + SAFARI;
  WINDOWS_PHONE = WINDOWS + " Phone";
  GENERIC_MOBILE = GENERIC + " mobile";
  GENERIC_TABLET = GENERIC + " tablet";
  DEFAULT_BROWSER_VERSION_REGEX = /* @__PURE__ */ new RegExp("Version/" + BROWSER_VERSION_REGEX_SUFFIX);
  AI_APP_VERSION_REGEX = /* @__PURE__ */ new RegExp("(" + CLAUDE + "|" + CODEX + "|" + CHATGPT + ")\\/" + BROWSER_VERSION_REGEX_SUFFIX);
  PLAYSTATION_REGEX = /* @__PURE__ */ new RegExp(PLAYSTATION + " \\w+", "i");
  NINTENDO_REGEX = /* @__PURE__ */ new RegExp(NINTENDO + " \\w+", "i");
  BLACKBERRY_REGEX = /* @__PURE__ */ new RegExp(BLACKBERRY + "|PlayBook|BB10", "i");
  windowsVersionMap = {
    "NT3.51": "NT 3.11",
    "NT4.0": "NT 4.0",
    "5.0": "2000",
    "5.1": "XP",
    "5.2": "XP",
    "6.0": "Vista",
    "6.1": "7",
    "6.2": "8",
    "6.3": "8.1",
    "6.4": "10",
    "10.0": "10"
  };
  versionRegexes = {
    [INTERNET_EXPLORER_MOBILE]: [
      /* @__PURE__ */ new RegExp("rv:" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [MICROSOFT_EDGE]: [
      /* @__PURE__ */ new RegExp(EDGE + "?\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [CHROME]: [
      /* @__PURE__ */ new RegExp("(" + CHROME + "|CrMo)\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [CHROME_IOS]: [
      /* @__PURE__ */ new RegExp("CriOS\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    "UC Browser": [
      /* @__PURE__ */ new RegExp("(UCBrowser|UCWEB)\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [SAFARI]: [
      DEFAULT_BROWSER_VERSION_REGEX
    ],
    [MOBILE_SAFARI]: [
      DEFAULT_BROWSER_VERSION_REGEX
    ],
    [OPERA]: [
      /* @__PURE__ */ new RegExp("(" + OPERA + "|OPR)\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [FIREFOX]: [
      /* @__PURE__ */ new RegExp(FIREFOX + "\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [FIREFOX_IOS]: [
      /* @__PURE__ */ new RegExp("FxiOS\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [KONQUEROR]: [
      /* @__PURE__ */ new RegExp("Konqueror[:/]?" + BROWSER_VERSION_REGEX_SUFFIX, "i")
    ],
    [BLACKBERRY]: [
      /* @__PURE__ */ new RegExp(BLACKBERRY + " " + BROWSER_VERSION_REGEX_SUFFIX),
      DEFAULT_BROWSER_VERSION_REGEX
    ],
    [ANDROID_MOBILE]: [
      /* @__PURE__ */ new RegExp("android\\s" + BROWSER_VERSION_REGEX_SUFFIX, "i")
    ],
    [SAMSUNG_INTERNET]: [
      /* @__PURE__ */ new RegExp(SAMSUNG_BROWSER + "\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [OCULUS_BROWSER]: [
      /* @__PURE__ */ new RegExp("OculusBrowser\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [VIVALDI]: [
      /* @__PURE__ */ new RegExp(VIVALDI + "\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [YANDEX]: [
      /* @__PURE__ */ new RegExp("YaBrowser\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [WHALE]: [
      /* @__PURE__ */ new RegExp(WHALE + "\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [BRAVE]: [
      /* @__PURE__ */ new RegExp(BRAVE + "\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [CLAUDE]: [
      AI_APP_VERSION_REGEX
    ],
    [CODEX]: [
      AI_APP_VERSION_REGEX
    ],
    [CHATGPT]: [
      AI_APP_VERSION_REGEX
    ],
    [DUCKDUCKGO]: [
      /* @__PURE__ */ new RegExp("(DuckDuckGo|Ddg)\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [PALE_MOON]: [
      /* @__PURE__ */ new RegExp("PaleMoon\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [WATERFOX]: [
      /* @__PURE__ */ new RegExp(WATERFOX + "\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [GOOGLE_SEARCH_APP]: [
      /* @__PURE__ */ new RegExp("GSA\\/" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    [INTERNET_EXPLORER]: [
      /* @__PURE__ */ new RegExp("(rv:|MSIE )" + BROWSER_VERSION_REGEX_SUFFIX)
    ],
    Mozilla: [
      /* @__PURE__ */ new RegExp("rv:" + BROWSER_VERSION_REGEX_SUFFIX)
    ]
  };
  osMatchers = [
    [
      /* @__PURE__ */ new RegExp(XBOX + "; " + XBOX + " (.*?)[);]", "i"),
      (match) => [
        XBOX,
        match && match[1] || ""
      ]
    ],
    [
      /* @__PURE__ */ new RegExp(NINTENDO, "i"),
      [
        NINTENDO,
        ""
      ]
    ],
    [
      /* @__PURE__ */ new RegExp(PLAYSTATION, "i"),
      [
        PLAYSTATION,
        ""
      ]
    ],
    [
      BLACKBERRY_REGEX,
      [
        BLACKBERRY,
        ""
      ]
    ],
    [
      /* @__PURE__ */ new RegExp(WINDOWS, "i"),
      (_, user_agent) => {
        if (/Phone/.test(user_agent) || /WPDesktop/.test(user_agent))
          return [
            WINDOWS_PHONE,
            ""
          ];
        if (new RegExp(MOBILE).test(user_agent) && !/IEMobile\b/.test(user_agent))
          return [
            WINDOWS + " " + MOBILE,
            ""
          ];
        const match = /Windows NT ([0-9.]+)/i.exec(user_agent);
        if (match && match[1]) {
          const version = match[1];
          let osVersion = windowsVersionMap[version] || "";
          if (/arm/i.test(user_agent))
            osVersion = "RT";
          return [
            WINDOWS,
            osVersion
          ];
        }
        return [
          WINDOWS,
          ""
        ];
      }
    ],
    [
      /((iPhone|iPad|iPod).*?OS (\d+)_(\d+)_?(\d+)?|iPhone)/,
      (match) => {
        if (match && match[3]) {
          const versionParts = [
            match[3],
            match[4],
            match[5] || "0"
          ];
          return [
            IOS,
            versionParts.join(".")
          ];
        }
        return [
          IOS,
          ""
        ];
      }
    ],
    [
      /(watch.*\/(\d+\.\d+\.\d+)|watch os,(\d+\.\d+),)/i,
      (match) => {
        let version = "";
        if (match && match.length >= 3)
          version = isUndefined(match[2]) ? match[3] : match[2];
        return [
          "watchOS",
          version
        ];
      }
    ],
    [
      /* @__PURE__ */ new RegExp("(" + ANDROID + " (\\d+)\\.(\\d+)\\.?(\\d+)?|" + ANDROID + ")", "i"),
      (match) => {
        if (match && match[2]) {
          const versionParts = [
            match[2],
            match[3],
            match[4] || "0"
          ];
          return [
            ANDROID,
            versionParts.join(".")
          ];
        }
        return [
          ANDROID,
          ""
        ];
      }
    ],
    [
      /Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i,
      (match) => {
        const result = [
          "Mac OS X",
          ""
        ];
        if (match && match[1]) {
          const versionParts = [
            match[1],
            match[2],
            match[3] || "0"
          ];
          result[1] = versionParts.join(".");
        }
        return result;
      }
    ],
    [
      /Mac/i,
      [
        "Mac OS X",
        ""
      ]
    ],
    [
      /CrOS/,
      [
        CHROME_OS,
        ""
      ]
    ],
    [
      /Linux|debian/i,
      [
        "Linux",
        ""
      ]
    ]
  ];
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/webview-app-utils.mjs
var init_webview_app_utils = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/json-utils.mjs
function sanitizeString(value) {
  let output = "";
  for (let index = 0;index < value.length; index++) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 55296 && codeUnit <= 56319) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 56320 && nextCodeUnit <= 57343) {
        output += value[index] + value[index + 1];
        index++;
      } else
        output += "�";
    } else
      output += codeUnit >= 56320 && codeUnit <= 57343 ? "�" : value[index];
  }
  return output;
}
function assignUserAttributes(target, source) {
  if (!source)
    return target;
  let keys = [];
  try {
    keys = Object.keys(source);
  } catch {
    keys = [];
  }
  for (const key of keys) {
    let value;
    try {
      value = source[key];
    } catch {
      value = UNSERIALIZABLE_VALUE;
    }
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return target;
}
var MAX_JSON_SAFE_VALUE_DEPTH = 20, MAX_JSON_SAFE_VALUE_ITEMS = 1000, MAX_JSON_SAFE_VALUE_NODES = 1e4, CIRCULAR_VALUE = "[Circular]", TRUNCATED_VALUE = "[Truncated]", UNSERIALIZABLE_VALUE = "[Unserializable]", FUNCTION_VALUE = "[Function]", dateGetTime, dateToISOString;
var init_json_utils = __esm(() => {
  dateGetTime = Date.prototype.getTime;
  dateToISOString = Date.prototype.toISOString;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/retry-after.mjs
function parseRetryAfterMs(value, now = Date.now(), maxMs = MAX_RETRY_AFTER_MS) {
  if (typeof value != "string" || !value)
    return;
  const raw = value.trim();
  const trimmed = /^\d+\s*,/.test(raw) ? raw.slice(0, raw.indexOf(",")).trim() : raw;
  if (/^\d+$/.test(trimmed)) {
    const ms = 1000 * Math.min(Number(trimmed), maxMs / 1000);
    return ms > 0 ? ms : undefined;
  }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[ ,]/.test(trimmed))
    return;
  const date = /^\w{3} \w{3} /.test(trimmed) ? trimmed + " GMT" : trimmed;
  const ms = Date.parse(date) - now;
  if (!Number.isFinite(ms) || ms <= 0)
    return;
  return Math.min(ms, maxMs);
}

class RetryAfterWindow {
  record(outcome) {
    if (outcome.kind === "too-large")
      return;
    if (outcome.kind !== "retry-later")
      return void this.reset();
    if (!outcome.retryAfterMs)
      return;
    const open = this.isOpen();
    const now = Date.now();
    const asked = Math.min(outcome.retryAfterMs, MAX_RETRY_AFTER_MS);
    if (!open) {
      this._installedAt = now;
      this._until = now + asked;
      return;
    }
    this._until = Math.max(this._until, Math.min(now + asked, this._installedAt + MAX_RETRY_AFTER_MS));
  }
  remainingMs() {
    const now = Date.now();
    if (now < this._installedAt - CLOCK_STEP_TOLERANCE_MS) {
      this.reset();
      return 0;
    }
    const remaining = Math.min(MAX_RETRY_AFTER_MS, Math.max(0, this._until - now));
    if (remaining === 0)
      this.reset();
    return remaining;
  }
  isOpen() {
    return this.remainingMs() > 0;
  }
  reset() {
    this._until = 0;
    this._installedAt = 0;
  }
  constructor() {
    this._until = 0;
    this._installedAt = 0;
  }
}
var MAX_RETRY_AFTER_MS = 300000, CLOCK_STEP_TOLERANCE_MS = 5000;
var init_retry_after = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/index.mjs
function isValidUUID(value) {
  return typeof value == "string" && UUID_REGEX.test(value);
}
function getEventUuid(uuid, generateUuid) {
  return isValidUUID(uuid) ? uuid : generateUuid();
}
function createNamedError(name, message) {
  const error = new Error(message);
  try {
    Object.defineProperty(error, "name", {
      value: name,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch {}
  return error;
}
function removeTrailingSlash(url) {
  return url?.replace(/\/+$/, "");
}
async function retriable(fn, props) {
  let lastError = null;
  for (let i = 0;i < props.retryCount + 1; i++) {
    if (i > 0)
      await new Promise((r) => setTimeout(r, props.retryDelay));
    try {
      const res = await fn();
      return res;
    } catch (e) {
      lastError = e;
      if (!props.retryCheck(e))
        throw e;
    }
  }
  throw lastError;
}
function currentISOTime() {
  return new Date().toISOString();
}
function safeSetTimeout(fn, timeout) {
  const t = setTimeout(fn, timeout);
  t?.unref && t?.unref();
  return t;
}
async function raceWithTimeout(promise, timeoutMs, onTimeout) {
  let timeoutHandle;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timeoutHandle = safeSetTimeout(() => {
          try {
            onTimeout?.();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}
function allSettled(promises) {
  return Promise.all(promises.map((p) => (p ?? Promise.resolve()).then((value) => ({
    status: "fulfilled",
    value
  }), (reason) => ({
    status: "rejected",
    reason
  }))));
}
var STRING_FORMAT = "utf8", UUID_REGEX, isPromise = (obj) => obj && typeof obj.then == "function";
var init_utils = __esm(() => {
  init_type_utils();
  init_json_utils();
  init_retry_after();
  init_bot_detection();
  init_browser_utils();
  init_bucketed_rate_limiter();
  init_number_utils();
  init_string_utils();
  init_type_utils();
  init_promise_queue();
  init_logger2();
  init_user_agent_utils();
  init_webview_app_utils();
  UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/chunk-ids.mjs
function getFilenameToChunkIdMap(stackParser) {
  const posthogChunkIds = globalThis._posthogChunkIds;
  const nativeDebugIds = globalThis._debugIds;
  if (!posthogChunkIds && !nativeDebugIds)
    return;
  const posthogKeys = posthogChunkIds ? Object.keys(posthogChunkIds) : [];
  const nativeKeys = nativeDebugIds ? Object.keys(nativeDebugIds) : [];
  if (cachedFilenameChunkIds && matchesSnapshot(posthogChunkIds, posthogKeys, lastPostHogChunkIds) && matchesSnapshot(nativeDebugIds, nativeKeys, lastNativeDebugIds))
    return cachedFilenameChunkIds;
  lastPostHogChunkIds = posthogChunkIds ? {
    ...posthogChunkIds
  } : undefined;
  lastNativeDebugIds = nativeDebugIds ? {
    ...nativeDebugIds
  } : undefined;
  cachedFilenameChunkIds = {};
  parsedStackResults ??= {};
  const addChunkIds = (keys, chunkIds) => {
    for (const stackKey of keys) {
      const chunkId = chunkIds[stackKey];
      if (!chunkId)
        continue;
      const cachedFilename = parsedStackResults?.[stackKey];
      if (cachedFilename) {
        cachedFilenameChunkIds[cachedFilename] = chunkId;
        continue;
      }
      const parsedStack = stackParser(stackKey);
      for (let i = parsedStack.length - 1;i >= 0; i--) {
        const filename = parsedStack[i]?.filename;
        if (filename) {
          cachedFilenameChunkIds[filename] = chunkId;
          parsedStackResults[stackKey] = filename;
          break;
        }
      }
    }
  };
  if (nativeDebugIds)
    addChunkIds(nativeKeys, nativeDebugIds);
  if (posthogChunkIds)
    addChunkIds(posthogKeys, posthogChunkIds);
  return cachedFilenameChunkIds;
}
function matchesSnapshot(chunkIds, keys, snapshot) {
  if (!chunkIds || !snapshot)
    return chunkIds === snapshot;
  return keys.length === Object.keys(snapshot).length && keys.every((key) => chunkIds[key] === snapshot[key]);
}
var parsedStackResults, lastPostHogChunkIds, lastNativeDebugIds, cachedFilenameChunkIds;
var init_chunk_ids = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/error-properties-builder.mjs
class ErrorPropertiesBuilder {
  constructor(coercers, stackParser, modifiers = []) {
    this.coercers = coercers;
    this.stackParser = stackParser;
    this.modifiers = modifiers;
  }
  buildFromUnknown(input, hint = {}) {
    const providedMechanism = hint && hint.mechanism;
    const mechanism = providedMechanism || {
      handled: true,
      type: "generic"
    };
    const coercingContext = this.buildCoercingContext(mechanism, hint, 0);
    const exceptionWithCause = coercingContext.apply(input);
    const parsingContext = this.buildParsingContext(hint);
    const exceptionWithStack = this.parseStacktrace(exceptionWithCause, parsingContext);
    const exceptionList = this.convertToExceptionList(exceptionWithStack, mechanism);
    return {
      $exception_list: exceptionList,
      $exception_level: "error"
    };
  }
  async modifyFrames(exceptionList) {
    for (const exc of exceptionList)
      if (exc.stacktrace && exc.stacktrace.frames && isArray(exc.stacktrace.frames))
        exc.stacktrace.frames = await this.applyModifiers(exc.stacktrace.frames);
    return exceptionList;
  }
  coerceFallback(ctx) {
    return {
      type: "Error",
      value: "Unknown error",
      stack: ctx.syntheticException?.stack,
      synthetic: true
    };
  }
  parseStacktrace(err, ctx) {
    let cause;
    if (err.cause != null)
      cause = this.parseStacktrace(err.cause, ctx);
    let stack;
    if (err.stack != "" && err.stack != null)
      try {
        stack = this.applyChunkIds(this.stackParser(err.stack, err.synthetic ? ctx.skipFirstLines : 0), ctx.chunkIdMap);
      } catch {}
    return {
      ...err,
      cause,
      stack,
      errors: err.errors?.map((child) => this.parseStacktrace(child, ctx))
    };
  }
  applyChunkIds(frames, chunkIdMap) {
    return frames.map((frame) => {
      if (frame.filename && chunkIdMap)
        frame.chunk_id = chunkIdMap[frame.filename];
      return frame;
    });
  }
  applyCoercers(input, ctx) {
    for (const adapter of this.coercers)
      if (adapter.match(input))
        return adapter.coerce(input, ctx);
    return this.coerceFallback(ctx);
  }
  async applyModifiers(frames) {
    let newFrames = frames;
    for (const modifier of this.modifiers)
      newFrames = await modifier(newFrames);
    return newFrames;
  }
  convertToExceptionList(exceptionWithStack, mechanism) {
    const exceptionList = [];
    const append = (exception, parentId, source) => {
      const exceptionId = exceptionList.length;
      const entryMechanism = parentId === undefined ? {
        type: typeof mechanism.type == "string" && mechanism.type.length > 0 ? mechanism.type : "generic",
        ...typeof mechanism.handled == "boolean" ? {
          handled: mechanism.handled
        } : mechanism.handled === undefined ? {
          handled: true
        } : {},
        synthetic: typeof mechanism.synthetic == "boolean" ? mechanism.synthetic : exception.synthetic,
        exception_id: exceptionId
      } : {
        type: "chained",
        source,
        synthetic: exception.synthetic,
        exception_id: exceptionId,
        parent_id: parentId
      };
      const currentException = {
        type: exception.type,
        value: exception.value,
        mechanism: entryMechanism
      };
      if (exception.stack)
        currentException.stacktrace = {
          type: "raw",
          frames: exception.stack
        };
      exceptionList.push(currentException);
      if (exception.cause)
        append(exception.cause, exceptionId, "cause");
      for (const child of exception.errors ?? [])
        append(child, exceptionId, "member");
    };
    append(exceptionWithStack);
    return exceptionList;
  }
  buildParsingContext(hint) {
    const context = {
      chunkIdMap: getFilenameToChunkIdMap(this.stackParser),
      skipFirstLines: hint.skipFirstLines ?? 1
    };
    return context;
  }
  getAggregateErrors(input) {
    try {
      if (isError(input)) {
        let prototype = Object.getPrototypeOf(input);
        for (let depth = 0;prototype && depth < MAX_ERROR_PROTOTYPE_DEPTH; depth++) {
          const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
          if (typeof constructor == "function" && constructor.name === "AggregateError") {
            const errors = input.errors;
            return isArray(errors) ? errors : undefined;
          }
          prototype = Object.getPrototypeOf(prototype);
        }
      }
    } catch {}
  }
  buildCoercingContext(mechanism, hint, depth = 0) {
    let count = 0;
    let memberInspections = 0;
    let hasAggregate = false;
    const seen = new Set;
    const wrappers = [];
    const skipped = {};
    const coerce = (input, depth, wrapperDepth = 0) => {
      const ctx = createContext(depth, wrapperDepth);
      const forward = ctx.apply;
      ctx.apply = (nextInput) => {
        wrappers.push(input);
        try {
          return forward(nextInput);
        } finally {
          wrappers.pop();
        }
      };
      if (wrapperDepth > MAX_WRAPPER_RECURSION || wrapperDepth > 0 && wrappers.indexOf(input) !== -1)
        return this.coerceFallback(ctx);
      const isReference = typeof input == "object" && input !== null || typeof input == "function";
      if (wrapperDepth === 0 && count >= MAX_EXCEPTIONS || isReference && seen.has(input))
        return;
      if (isReference)
        seen.add(input);
      if (wrapperDepth === 0)
        count++;
      const errors = this.getAggregateErrors(input);
      hasAggregate ||= !!errors;
      let exception;
      try {
        exception = this.applyCoercers(input, ctx);
        if (!exception)
          throw skipped;
      } catch (error) {
        if (error === skipped) {
          if (wrapperDepth === 0)
            count--;
          return;
        }
        if (!hasAggregate)
          throw error;
        exception = this.coerceFallback(ctx);
      }
      if (!errors || count >= MAX_EXCEPTIONS)
        return exception;
      let length;
      try {
        length = errors.length;
      } catch {
        return exception;
      }
      if (!Number.isInteger(length) || length < 0 || length > 4294967295)
        return exception;
      const children = [];
      for (let index = 0;count < MAX_EXCEPTIONS && memberInspections < MAX_AGGREGATE_MEMBER_INSPECTIONS && index < length; index++) {
        memberInspections++;
        let child;
        try {
          child = ctx.next(errors[index]);
        } catch {
          count++;
          child = this.coerceFallback(createContext(depth + 1));
        }
        if (child)
          children.push(child);
      }
      return {
        ...exception,
        errors: children
      };
    };
    const createContext = (depth, wrapperDepth = 0) => ({
      ...hint,
      syntheticException: depth == 0 ? hint.syntheticException : undefined,
      mechanism: depth == 0 ? mechanism : {},
      apply: (input) => {
        const exception = coerce(input, depth, wrapperDepth + 1);
        if (!exception)
          throw skipped;
        return exception;
      },
      next: (input) => coerce(input, depth + 1)
    });
    const context = createContext(depth);
    return {
      ...context,
      apply: (input) => coerce(input, depth) ?? this.coerceFallback(context)
    };
  }
}
var MAX_EXCEPTIONS = 50, MAX_AGGREGATE_MEMBER_INSPECTIONS = 1000, MAX_ERROR_PROTOTYPE_DEPTH = 100, MAX_WRAPPER_RECURSION = 4;
var init_error_properties_builder = __esm(() => {
  init_utils();
  init_chunk_ids();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/base.mjs
function isAppFilename(filename) {
  if (!filename || filename === ANONYMOUS_FILENAME)
    return false;
  const scheme = URL_SCHEME.exec(filename);
  return !scheme || APP_URL_SCHEMES.includes(scheme[1].toLowerCase());
}
function createFrame(platform, filename, func, lineno, colno) {
  const frame = {
    platform,
    filename,
    function: func === "<anonymous>" ? UNKNOWN_FUNCTION : func,
    in_app: isAppFilename(filename)
  };
  if (!isUndefined(lineno))
    frame.lineno = lineno;
  if (!isUndefined(colno))
    frame.colno = colno;
  return frame;
}
var UNKNOWN_FUNCTION = "?", ANONYMOUS_FILENAME = "<anonymous>", URL_SCHEME, APP_URL_SCHEMES;
var init_base2 = __esm(() => {
  init_utils();
  URL_SCHEME = /^([a-z][a-z0-9.+-]+):/i;
  APP_URL_SCHEMES = [
    "http",
    "https",
    "file",
    "blob",
    "app",
    "capacitor",
    "ionic",
    "webpack",
    "webpack-internal",
    "ng"
  ];
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/safari.mjs
var extractSafariExtensionDetails = (func, filename) => {
  const isSafariExtension = func.indexOf("safari-extension") !== -1;
  const isSafariWebExtension = func.indexOf("safari-web-extension") !== -1;
  return isSafariExtension || isSafariWebExtension ? [
    func.indexOf("@") !== -1 ? func.split("@")[0] : UNKNOWN_FUNCTION,
    isSafariExtension ? `safari-extension:${filename}` : `safari-web-extension:${filename}`
  ] : [
    func,
    filename
  ];
};
var init_safari = __esm(() => {
  init_base2();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/chrome.mjs
var chromeRegexNoFnName, chromeRegex, chromeEvalRegex, chromeStackLineParser = (line, platform) => {
  const noFnParts = chromeRegexNoFnName.exec(line);
  if (noFnParts) {
    const [, filename, line, col] = noFnParts;
    return createFrame(platform, filename, UNKNOWN_FUNCTION, +line, +col);
  }
  const parts = chromeRegex.exec(line);
  if (parts) {
    const isEval = parts[2] && parts[2].indexOf("eval") === 0;
    if (isEval) {
      const subMatch = chromeEvalRegex.exec(parts[2]);
      if (subMatch) {
        parts[2] = subMatch[1];
        parts[3] = subMatch[2];
        parts[4] = subMatch[3];
      }
    }
    const [func, filename] = extractSafariExtensionDetails(parts[1] || UNKNOWN_FUNCTION, parts[2]);
    return createFrame(platform, filename, func, parts[3] ? +parts[3] : undefined, parts[4] ? +parts[4] : undefined);
  }
};
var init_chrome = __esm(() => {
  init_base2();
  init_safari();
  chromeRegexNoFnName = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
  chromeRegex = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
  chromeEvalRegex = /\((\S*)(?::(\d+))(?::(\d+))\)/;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/gecko.mjs
var geckoREgex, geckoEvalRegex, geckoStackLineParser = (line, platform) => {
  const parts = geckoREgex.exec(line);
  if (parts) {
    const isEval = parts[3] && parts[3].indexOf(" > eval") > -1;
    if (isEval) {
      const subMatch = geckoEvalRegex.exec(parts[3]);
      if (subMatch) {
        parts[1] = parts[1] || "eval";
        parts[3] = subMatch[1];
        parts[4] = subMatch[2];
        parts[5] = "";
      }
    }
    let filename = parts[3];
    let func = parts[1] || UNKNOWN_FUNCTION;
    [func, filename] = extractSafariExtensionDetails(func, filename);
    return createFrame(platform, filename, func, parts[4] ? +parts[4] : undefined, parts[5] ? +parts[5] : undefined);
  }
};
var init_gecko = __esm(() => {
  init_base2();
  init_safari();
  geckoREgex = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
  geckoEvalRegex = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/winjs.mjs
var init_winjs = __esm(() => {
  init_base2();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/opera.mjs
var init_opera = __esm(() => {
  init_base2();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/node.mjs
function filenameIsInApp(filename, isNative = false) {
  const isInternal = isNative || filename && !filename.startsWith("/") && !filename.match(/^[A-Z]:/) && !filename.startsWith(".") && !filename.match(/^[a-zA-Z]([a-zA-Z0-9.\-+])*:\/\//);
  return !isInternal && filename !== undefined && !filename.includes("node_modules/");
}
function _parseIntOrUndefined(input) {
  return parseInt(input || "", 10) || undefined;
}
var FILENAME_MATCH, FULL_MATCH, PROMISE_COMBINATOR, PROMISE_INDEX, PROMISE_FRAME_FILENAME = "node:internal/promise", nodeStackLineParser = (line, platform) => {
  const lineMatch = line.match(FULL_MATCH);
  if (lineMatch) {
    let object;
    let method;
    let functionName;
    let typeName;
    let methodName;
    if (lineMatch[1]) {
      functionName = lineMatch[1];
      let methodStart = functionName.lastIndexOf(".");
      if (functionName[methodStart - 1] === ".")
        methodStart--;
      if (methodStart > 0) {
        object = functionName.slice(0, methodStart);
        method = functionName.slice(methodStart + 1);
        const objectEnd = object.indexOf(".Module");
        if (objectEnd > 0) {
          functionName = functionName.slice(objectEnd + 1);
          object = object.slice(0, objectEnd);
        }
      }
      typeName = undefined;
    }
    if (method) {
      typeName = object;
      methodName = method;
    }
    if (method === "<anonymous>") {
      methodName = undefined;
      functionName = undefined;
    }
    if (functionName === undefined) {
      methodName = methodName || UNKNOWN_FUNCTION;
      functionName = typeName ? `${typeName}.${methodName}` : methodName;
    }
    let filename = lineMatch[2]?.startsWith("file://") ? lineMatch[2].slice(7) : lineMatch[2];
    const isNative = lineMatch[5] === "native";
    if (filename?.match(/\/[A-Z]:/))
      filename = filename.slice(1);
    if (!filename && lineMatch[5] && !isNative)
      filename = lineMatch[5];
    if (PROMISE_COMBINATOR.test(functionName) && PROMISE_INDEX.test(filename || ""))
      filename = PROMISE_FRAME_FILENAME;
    return {
      filename: filename ? decodeURI(filename) : undefined,
      module: undefined,
      function: functionName,
      lineno: _parseIntOrUndefined(lineMatch[3]),
      colno: _parseIntOrUndefined(lineMatch[4]),
      in_app: filenameIsInApp(filename || "", isNative),
      platform
    };
  }
  if (line.match(FILENAME_MATCH))
    return {
      filename: line,
      platform
    };
};
var init_node = __esm(() => {
  init_base2();
  FILENAME_MATCH = /^\s*[-]{4,}$/;
  FULL_MATCH = /at (?:async (?!\((?!.*\)\s+\()))?(?:(.+?)\s+\()?(?:(.+):(\d+):(\d+)?|([^)]+))\)?/;
  PROMISE_COMBINATOR = /^Promise\.(?:all|any)$/;
  PROMISE_INDEX = /^index \d+$/;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/parsers/index.mjs
function isSameFrame(a, b) {
  return a.filename === b.filename && a.function === b.function && a.module === b.module && a.lineno === b.lineno && a.colno === b.colno;
}
function collapseRepeatedCycle(frames) {
  for (let length = 1;length <= MAX_REPEATED_CYCLE_LENGTH; length++) {
    const start = frames.length - 2 * length;
    if (start < 0)
      break;
    let isCycle = true;
    for (let offset = 0;offset < length; offset++) {
      const inner = frames[start + offset];
      if (!isSameFrame(inner, frames[start + length + offset])) {
        isCycle = false;
        break;
      }
    }
    if (isCycle) {
      for (let offset = 0;offset < length; offset++)
        frames[start + offset] = frames[start + length + offset];
      frames.length = start + length;
      return {
        start,
        length
      };
    }
  }
}
function trimPartialCycle(frames, cycle) {
  const copyEnd = cycle.start + cycle.length;
  const partialLength = partialCycleLength(frames, cycle);
  if (partialLength)
    frames.splice(copyEnd + partialLength === frames.length ? copyEnd : cycle.start, partialLength);
}
function innermostPartialCycleLength(frames, cycle) {
  let partialStart = cycle.start;
  while (partialStart > 0 && isSameFrame(frames[partialStart - 1], frames[partialStart - 1 + cycle.length]))
    partialStart--;
  return cycle.start - partialStart;
}
function partialCycleLength(frames, cycle) {
  const copyEnd = cycle.start + cycle.length;
  let partialEnd = copyEnd;
  while (partialEnd < frames.length && isSameFrame(frames[partialEnd], frames[partialEnd - cycle.length]))
    partialEnd++;
  return partialEnd - copyEnd;
}
function survivingFrameCount(frames, cycles) {
  const innermostCycle = cycles[0];
  let count = frames.length - (innermostCycle ? innermostPartialCycleLength(frames, innermostCycle) : 0);
  for (const cycle of cycles)
    count -= partialCycleLength(frames, cycle);
  return count;
}
function canonicalizeCycleRotation(frames) {
  const keys = frames.map((frame) => `${frame.function}|${frame.filename}|${frame.lineno}|${frame.colno}|${frame.module}`);
  let first = 0;
  for (let i = 1;i < keys.length; i++)
    if (isSmallerRotation(keys, i, first))
      first = i;
  frames.push(...frames.splice(0, first));
}
function isSmallerRotation(keys, candidate, best) {
  for (let offset = 0;offset < keys.length; offset++) {
    const left = keys[(candidate + offset) % keys.length];
    const right = keys[(best + offset) % keys.length];
    if (left !== right)
      return left < right;
  }
  return false;
}
function reverseAndStripFrames(stack) {
  if (!stack.length)
    return [];
  const localStack = Array.from(stack);
  localStack.reverse();
  return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame) => ({
    ...frame,
    filename: frame.filename || getLastStackFrame(localStack).filename,
    function: frame.function || UNKNOWN_FUNCTION
  }));
}
function getLastStackFrame(arr) {
  return arr[arr.length - 1] || {};
}
function createDefaultStackParser() {
  return createStackParser("web:javascript", chromeStackLineParser, geckoStackLineParser);
}
function createStackParser(platform, ...parsers) {
  return (stack, skipFirstLines = 0) => {
    const frames = [];
    const lines = stack.split(`
`);
    const endLine = Math.min(lines.length, skipFirstLines + STACKTRACE_LINE_LIMIT);
    const repeatedCycles = [];
    for (let i = skipFirstLines;i < endLine; i++) {
      const line = lines[i];
      if (line.length > 1024)
        continue;
      const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, "$1") : line;
      if (!cleanedLine.match(/\S*Error: /)) {
        for (const parser of parsers) {
          const frame = parser(cleanedLine, platform);
          if (frame) {
            frames.push(frame);
            const cycle = collapseRepeatedCycle(frames);
            if (cycle) {
              for (let i = repeatedCycles.length - 1;i >= 0; i--) {
                const previous = repeatedCycles[i];
                if (previous.start + previous.length <= cycle.start)
                  break;
                repeatedCycles.pop();
              }
              repeatedCycles.push(cycle);
            }
            break;
          }
        }
        if (survivingFrameCount(frames, repeatedCycles) >= STACKTRACE_FRAME_LIMIT)
          break;
      }
    }
    const sections = [
      ...repeatedCycles
    ].sort((a, b) => b.start - a.start);
    const innermostSection = sections[sections.length - 1];
    if (innermostSection) {
      const trimmed = innermostPartialCycleLength(frames, innermostSection);
      frames.splice(innermostSection.start - trimmed, trimmed);
      for (const cycle of sections)
        cycle.start -= trimmed;
    }
    for (const cycle of sections)
      trimPartialCycle(frames, cycle);
    if (repeatedCycles.some((cycle) => cycle.start === 0 && frames.length === cycle.length))
      canonicalizeCycleRotation(frames);
    return reverseAndStripFrames(frames);
  };
}
var WEBPACK_ERROR_REGEXP, STACKTRACE_FRAME_LIMIT = 50, MAX_REPEATED_CYCLE_LENGTH = 10, STACKTRACE_LINE_LIMIT = 1000;
var init_parsers = __esm(() => {
  init_base2();
  init_chrome();
  init_gecko();
  init_winjs();
  init_opera();
  init_node();
  WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/dom-exception-coercer.mjs
var init_dom_exception_coercer = __esm(() => {
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/error-coercer.mjs
class ErrorCoercer {
  match(err) {
    return isError(err);
  }
  coerce(err, ctx) {
    const stack = this.getStack(err);
    const replacementStack = stack === undefined ? ctx.syntheticException?.stack : undefined;
    const synthetic = !!replacementStack;
    return {
      type: this.getType(err),
      value: this.getMessage(err, ctx),
      stack: stack ?? replacementStack,
      cause: err.cause ? ctx.next(err.cause) : undefined,
      synthetic
    };
  }
  getType(err) {
    return err.name || err.constructor.name;
  }
  getMessage(err, _ctx) {
    const message = err.message;
    if (message.error && typeof message.error.message == "string")
      return String(message.error.message);
    return String(message);
  }
  getStack(err) {
    try {
      const stacktrace = err.stacktrace;
      if (typeof stacktrace == "string" && stacktrace.length > 0)
        return stacktrace;
      const stack = err.stack;
      return typeof stack == "string" && stack.length > 0 ? stack : undefined;
    } catch {
      return;
    }
  }
}
var init_error_coercer = __esm(() => {
  init_type_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/error-event-coercer.mjs
var init_error_event_coercer = __esm(() => {
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/string-coercer.mjs
class StringCoercer {
  match(input) {
    return typeof input == "string";
  }
  coerce(input, ctx) {
    const [type, value] = this.getInfos(input);
    return {
      type: type ?? "Error",
      value: value ?? input,
      stack: ctx.syntheticException?.stack,
      synthetic: true
    };
  }
  getInfos(candidate) {
    let type = "Error";
    let value = candidate;
    const groups = candidate.match(ERROR_TYPES_PATTERN);
    if (groups) {
      type = groups[1];
      value = groups[2];
    }
    return [
      type,
      value
    ];
  }
}
var ERROR_TYPES_PATTERN;
var init_string_coercer = __esm(() => {
  ERROR_TYPES_PATTERN = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/types.mjs
var severityLevels;
var init_types2 = __esm(() => {
  severityLevels = [
    "fatal",
    "error",
    "warning",
    "log",
    "info",
    "debug"
  ];
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/utils.mjs
function extractExceptionKeysForMessage(err, maxLength = 40) {
  const keys = Object.keys(err);
  keys.sort();
  if (!keys.length)
    return "[object has no keys]";
  for (let i = keys.length;i > 0; i--) {
    const serialized = keys.slice(0, i).join(", ");
    if (!(serialized.length > maxLength)) {
      if (i === keys.length)
        return serialized;
      return serialized.length <= maxLength ? serialized : `${serialized.slice(0, maxLength)}...`;
    }
  }
  return "";
}
var init_utils2 = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/object-coercer.mjs
class ObjectCoercer {
  match(candidate) {
    return typeof candidate == "object" && candidate !== null;
  }
  coerce(candidate, ctx) {
    const errorProperty = this.getErrorPropertyFromObject(candidate);
    if (errorProperty)
      return ctx.apply(errorProperty);
    return {
      type: this.getType(candidate),
      value: this.getValue(candidate),
      stack: this.getStack(candidate) ?? ctx.syntheticException?.stack,
      level: this.isSeverityLevel(candidate.level) ? candidate.level : "error",
      synthetic: true
    };
  }
  getType(err) {
    if (isEvent(err))
      return err.constructor.name;
    const name = "name" in err ? err.name : undefined;
    return isString(name) && !isEmptyString(name) ? name : "Error";
  }
  getValue(err) {
    if ("name" in err && typeof err.name == "string") {
      let message = `'${err.name}' captured as exception`;
      if ("message" in err && typeof err.message == "string")
        message += ` with message: '${err.message}'`;
      return message;
    }
    if ("message" in err && typeof err.message == "string")
      return err.message;
    const className = this.getObjectClassName(err);
    const keys = extractExceptionKeysForMessage(err);
    return `${className && className !== "Object" ? `'${className}'` : "Object"} captured as exception with keys: ${keys}`;
  }
  isSeverityLevel(x) {
    return isString(x) && !isEmptyString(x) && severityLevels.indexOf(x) >= 0;
  }
  getStack(candidate) {
    try {
      if (isString(candidate.stacktrace) && candidate.stacktrace.length > 0)
        return candidate.stacktrace;
      return isString(candidate.stack) && candidate.stack.length > 0 ? candidate.stack : undefined;
    } catch {
      return;
    }
  }
  getErrorPropertyFromObject(obj) {
    for (const prop in obj)
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        const value = obj[prop];
        if (isError(value))
          return value;
      }
  }
  getObjectClassName(obj) {
    try {
      const prototype = Object.getPrototypeOf(obj);
      return prototype ? prototype.constructor.name : undefined;
    } catch (e) {
      return;
    }
  }
}
var init_object_coercer = __esm(() => {
  init_utils();
  init_types2();
  init_utils2();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/event-coercer.mjs
class EventCoercer {
  match(err) {
    return isEvent(err);
  }
  coerce(evt, ctx) {
    const constructorName = evt.constructor.name;
    return {
      type: constructorName,
      value: `${constructorName} captured as exception with keys: ${extractExceptionKeysForMessage(evt)}`,
      stack: ctx.syntheticException?.stack,
      synthetic: true
    };
  }
}
var init_event_coercer = __esm(() => {
  init_utils();
  init_utils2();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/primitive-coercer.mjs
class PrimitiveCoercer {
  match(candidate) {
    return isPrimitive(candidate);
  }
  coerce(value, ctx) {
    return {
      type: "Error",
      value: `Primitive value captured as exception: ${String(value)}`,
      stack: ctx.syntheticException?.stack,
      synthetic: true
    };
  }
}
var init_primitive_coercer = __esm(() => {
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/promise-rejection-event.mjs
var init_promise_rejection_event = __esm(() => {
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/coercers/index.mjs
var init_coercers = __esm(() => {
  init_dom_exception_coercer();
  init_error_coercer();
  init_error_event_coercer();
  init_string_coercer();
  init_object_coercer();
  init_event_coercer();
  init_primitive_coercer();
  init_promise_rejection_event();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/utils.mjs
class ReduceableCache {
  constructor(_maxSize) {
    this._maxSize = _maxSize;
    this._cache = new Map;
  }
  get(key) {
    const value = this._cache.get(key);
    if (value === undefined)
      return;
    this._cache.delete(key);
    this._cache.set(key, value);
    return value;
  }
  set(key, value) {
    this._cache.set(key, value);
  }
  reduce() {
    while (this._cache.size >= this._maxSize) {
      const value = this._cache.keys().next().value;
      if (value)
        this._cache.delete(value);
    }
  }
}
var init_utils3 = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/exception-steps.mjs
var EXCEPTION_STEP_INTERNAL_FIELDS, RESERVED_EXCEPTION_STEP_KEYS;
var init_exception_steps = __esm(() => {
  init_utils();
  EXCEPTION_STEP_INTERNAL_FIELDS = {
    MESSAGE: "$message",
    TIMESTAMP: "$timestamp"
  };
  RESERVED_EXCEPTION_STEP_KEYS = new Set([
    EXCEPTION_STEP_INTERNAL_FIELDS.MESSAGE,
    EXCEPTION_STEP_INTERNAL_FIELDS.TIMESTAMP
  ]);
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/release.mjs
function getInjectedReleaseId() {
  if ("u" > typeof process) {
    const fromEnvironment = process.env.POSTHOG_RELEASE_ID?.trim();
    if (fromEnvironment)
      return fromEnvironment;
  }
  const injected = globalThis._posthogReleaseId;
  return typeof injected == "string" && injected.length > 0 ? injected : undefined;
}
var init_release = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/error-tracking/index.mjs
var init_error_tracking = __esm(() => {
  init_error_properties_builder();
  init_parsers();
  init_coercers();
  init_utils3();
  init_exception_steps();
  init_release();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/cookie.mjs
var init_cookie = __esm(() => {
  init_utils();
  init_uuidv7();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/featureFlagUtils.mjs
function getFlagDetailFromFlagAndPayload(key, value, payload) {
  return {
    key,
    enabled: typeof value == "string" ? true : value,
    variant: typeof value == "string" ? value : undefined,
    reason: undefined,
    metadata: {
      id: undefined,
      version: undefined,
      payload: payload ? JSON.stringify(payload) : undefined,
      description: undefined
    }
  };
}
var normalizeFlagsResponse = (flagsResponse) => {
  if ("flags" in flagsResponse) {
    const featureFlags = getFlagValuesFromFlags(flagsResponse.flags);
    const featureFlagPayloads = getPayloadsFromFlags(flagsResponse.flags);
    return {
      ...flagsResponse,
      featureFlags,
      featureFlagPayloads
    };
  }
  {
    const featureFlags = flagsResponse.featureFlags ?? {};
    const featureFlagPayloads = Object.fromEntries(Object.entries(flagsResponse.featureFlagPayloads || {}).map(([k, v]) => [
      k,
      parsePayload(v)
    ]));
    const flags = Object.fromEntries(Object.entries(featureFlags).map(([key, value]) => [
      key,
      getFlagDetailFromFlagAndPayload(key, value, featureFlagPayloads[key])
    ]));
    return {
      ...flagsResponse,
      featureFlags,
      featureFlagPayloads,
      flags
    };
  }
}, getFlagValuesFromFlags = (flags) => Object.fromEntries(Object.entries(flags ?? {}).map(([key, detail]) => [
  key,
  getFeatureFlagValue(detail)
]).filter(([, value]) => value !== undefined)), getPayloadsFromFlags = (flags) => {
  const safeFlags = flags ?? {};
  return Object.fromEntries(Object.keys(safeFlags).filter((flag) => {
    const details = safeFlags[flag];
    return details.enabled && details.metadata && details.metadata.payload !== undefined;
  }).map((flag) => {
    const payload = safeFlags[flag].metadata?.payload;
    return [
      flag,
      payload ? parsePayload(payload) : undefined
    ];
  }));
}, getFeatureFlagValue = (detail) => detail === undefined ? undefined : detail.variant ?? detail.enabled, parsePayload = (response) => {
  if (typeof response != "string")
    return response;
  try {
    return JSON.parse(response);
  } catch {
    return response;
  }
}, MINIMAL_FLAG_CALLED_EVENT_CAMPAIGN_PROPERTIES, MINIMAL_FLAG_CALLED_EVENT_PROPERTIES, minimizeFlagCalledEventProperties = (properties, transportKeys = []) => {
  const minimal = {};
  const copyKey = (key) => {
    if (properties[key] !== undefined)
      minimal[key] = properties[key];
  };
  MINIMAL_FLAG_CALLED_EVENT_PROPERTIES.forEach(copyKey);
  transportKeys.forEach(copyKey);
  return minimal;
};
var init_featureFlagUtils = __esm(() => {
  MINIMAL_FLAG_CALLED_EVENT_CAMPAIGN_PROPERTIES = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gad_source",
    "mc_cid",
    "gclid",
    "gclsrc",
    "dclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "msclkid",
    "twclid",
    "li_fat_id",
    "igshid",
    "ttclid",
    "rdt_cid",
    "epik",
    "qclid",
    "sccid",
    "oppref",
    "bfcid",
    "irclid",
    "_kx"
  ];
  MINIMAL_FLAG_CALLED_EVENT_PROPERTIES = [
    "$feature_flag",
    "$feature_flag_response",
    "$feature_flag_has_experiment",
    "$feature_flag_id",
    "$feature_flag_version",
    "$feature_flag_reason",
    "$feature_flag_request_id",
    "$feature_flag_evaluated_at",
    "$feature_flag_error",
    "locally_evaluated",
    "$groups",
    "$process_person_profile",
    "$geoip_disable",
    "$current_url",
    "$pathname",
    "$referring_domain",
    ...MINIMAL_FLAG_CALLED_EVENT_CAMPAIGN_PROPERTIES,
    "$session_id",
    "$window_id",
    "$lib",
    "$lib_version",
    "$device_id",
    "$is_server"
  ];
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/eventemitter.mjs
class SimpleEventEmitter {
  constructor() {
    this.events = {};
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event])
      this.events[event] = [];
    this.events[event].push(listener);
    return () => {
      this.events[event] = this.events[event].filter((x) => x !== listener);
    };
  }
  emit(event, payload) {
    for (const listener of this.events[event] || [])
      listener(payload);
    for (const listener of this.events["*"] || [])
      listener(event, payload);
  }
}
var init_eventemitter = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/gzip.mjs
function isGzipSupported() {
  return "CompressionStream" in globalThis && "TextEncoder" in globalThis && "Response" in globalThis && typeof Response.prototype.blob == "function";
}
async function gzipCompress(input, isDebug = true, options) {
  try {
    const inputBytes = new TextEncoder().encode(input);
    const compressedStream = new globalThis.CompressionStream("gzip");
    const writer = compressedStream.writable.getWriter();
    const writePromise = writer.write(inputBytes).then(() => writer.close()).catch(async (err) => {
      try {
        await writer.abort(err);
      } catch {}
      throw err;
    });
    const responsePromise = new Response(compressedStream.readable).blob();
    const [compressed] = await Promise.all([
      responsePromise,
      writePromise
    ]);
    await validateNativeGzip(compressed, inputBytes);
    return compressed;
  } catch (error) {
    if (options?.rethrow)
      throw error;
    if (isDebug)
      console.error("Failed to gzip compress data", error);
    return null;
  }
}
var NATIVE_GZIP_VALIDATION_ERROR = "NativeGzipValidationError", GZIP_MAGIC_FIRST_BYTE = 31, GZIP_MAGIC_SECOND_BYTE = 139, GZIP_DEFLATE_METHOD = 8, hasGzipMagic = (bytes) => bytes.length >= 2 && bytes[0] === GZIP_MAGIC_FIRST_BYTE && bytes[1] === GZIP_MAGIC_SECOND_BYTE, crc32Table, getCrc32Table = () => {
  if (crc32Table)
    return crc32Table;
  crc32Table = [];
  for (let i = 0;i < 256; i++) {
    let crc = i;
    for (let j = 0;j < 8; j++)
      crc = 1 & crc ? 3988292384 ^ crc >>> 1 : crc >>> 1;
    crc32Table[i] = crc >>> 0;
  }
  return crc32Table;
}, crc32 = (bytes) => {
  const table = getCrc32Table();
  let crc = 4294967295;
  for (let i = 0;i < bytes.length; i++)
    crc = table[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  return (4294967295 ^ crc) >>> 0;
}, throwNativeGzipValidationError = (reason) => {
  throw createNamedError(NATIVE_GZIP_VALIDATION_ERROR, `Native gzip produced invalid output: ${reason}`);
}, validateNativeGzip = async (compressed, inputBytes) => {
  if (compressed.size < 18)
    throwNativeGzipValidationError("too-short");
  const header = new Uint8Array(await compressed.slice(0, 10).arrayBuffer());
  if (!hasGzipMagic(header) || header[2] !== GZIP_DEFLATE_METHOD)
    throwNativeGzipValidationError("invalid-header");
  const trailer = new DataView(await compressed.slice(compressed.size - 8).arrayBuffer());
  if (trailer.getUint32(0, true) !== crc32(inputBytes))
    throwNativeGzipValidationError("invalid-crc");
  const inputSize = inputBytes.length >>> 0;
  if (trailer.getUint32(4, true) !== inputSize)
    throwNativeGzipValidationError("invalid-size");
};
var init_gzip = __esm(() => {
  init_types();
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/posthog-core-stateless.mjs
async function logFlushError(err) {
  if (err instanceof PostHogFetchHttpError) {
    let text = "";
    try {
      text = await err.text;
    } catch {
      if (err.bodyReadTimedOut)
        text = "<response body read timed out>";
    }
    console.error(`Error while flushing PostHog: message=${err.message}, response body=${text}`, err);
  } else
    console.error("Error while flushing PostHog", err);
  return Promise.resolve();
}
function isPostHogFetchError(err) {
  return typeof err == "object" && (err instanceof PostHogFetchHttpError || isPostHogFetchNetworkError(err));
}
function isPostHogFetchNetworkError(err) {
  return err instanceof PostHogFetchNetworkError;
}
function isRetryableFlagsFetchError(err) {
  if (err instanceof PostHogFetchHttpError)
    return err.status === 502 || err.status === 504;
  if (!(err instanceof PostHogFetchNetworkError))
    return false;
  const cause = err.error;
  const code = cause?.code ?? cause?.cause?.code;
  return code !== "ECONNREFUSED";
}
function byteLengthOf(body) {
  try {
    if (typeof body != "string")
      return body instanceof Uint8Array ? body.byteLength : body.size;
    if ("u" > typeof Buffer)
      return Buffer.byteLength(body, STRING_FORMAT);
    return new TextEncoder().encode(body).length;
  } catch {
    return 0;
  }
}
function isPostHogFetchContentTooLargeError(err) {
  return typeof err == "object" && err instanceof PostHogFetchHttpError && err.status === 413;
}
function isPostHogFetchRetryableError(err) {
  if (err instanceof PostHogFetchHttpError)
    return err.status === 408 || err.status === 429 || err.status >= 500;
  return isPostHogFetchNetworkError(err);
}
function isPostHogEventProperties(value) {
  return value !== null && typeof value == "object" && !Array.isArray(value);
}

class PostHogCoreStateless {
  getErrorPropertiesBuilder() {
    if (!this._errorPropertiesBuilder)
      this._errorPropertiesBuilder = this.createErrorPropertiesBuilder();
    return this._errorPropertiesBuilder;
  }
  createErrorPropertiesBuilder() {
    return new ErrorPropertiesBuilder([
      new ErrorCoercer,
      new ObjectCoercer,
      new StringCoercer,
      new PrimitiveCoercer
    ], createDefaultStackParser());
  }
  getEvaluationRuntime() {}
  get apiKey() {
    return this.projectToken;
  }
  constructor(projectToken, options = {}) {
    this.flushPromise = null;
    this.pendingFlushPromise = null;
    this.flushPromises = new Set;
    this._dequeuedMessagesCount = 0;
    this.shutdownPromise = null;
    this.promiseQueue = new PromiseQueue;
    this._events = new SimpleEventEmitter;
    this._isInitialized = false;
    const normalizedProjectToken = typeof projectToken == "string" ? projectToken.trim() : "";
    const normalizedHost = typeof options.host == "string" ? options.host.trim() : "";
    const missingProjectToken = !normalizedProjectToken;
    this._logger = createLogger2("[PostHog]", this.logMsgIfDebug.bind(this));
    if (missingProjectToken)
      this._logger.error("You must pass your PostHog project token. The client will be disabled.");
    this.projectToken = normalizedProjectToken;
    this.host = removeTrailingSlash(normalizedHost || "https://us.i.posthog.com");
    this.flushAt = options.flushAt ? Math.max(options.flushAt, 1) : 20;
    this.maxBatchSize = Math.max(this.flushAt, options.maxBatchSize ?? 100);
    this.maxQueueSize = Math.max(this.flushAt, options.maxQueueSize ?? 1000);
    this.flushInterval = options.flushInterval ?? 1e4;
    this.preloadFeatureFlags = options.preloadFeatureFlags ?? true;
    this.defaultOptIn = options.defaultOptIn ?? true;
    this.disableSurveys = options.disableSurveys ?? false;
    this._retryOptions = {
      retryCount: options.fetchRetryCount ?? 3,
      retryDelay: options.fetchRetryDelay ?? 3000,
      retryCheck: isPostHogFetchRetryableError
    };
    this.requestTimeout = options.requestTimeout ?? 1e4;
    this.featureFlagsRequestTimeoutMs = options.featureFlagsRequestTimeoutMs ?? 3000;
    this.featureFlagsRequestMaxRetries = options.featureFlagsRequestMaxRetries ?? 1;
    this.remoteConfigRequestTimeoutMs = options.remoteConfigRequestTimeoutMs ?? 3000;
    this.disableGeoip = options.disableGeoip ?? true;
    this.disabled = (options.disabled ?? false) || missingProjectToken;
    this.historicalMigration = options?.historicalMigration ?? false;
    this._initPromise = Promise.resolve();
    this._isInitialized = true;
    this.evaluationContexts = options?.evaluationContexts ?? options?.evaluationEnvironments;
    if (options?.evaluationEnvironments && !options?.evaluationContexts)
      this._logger.warn("evaluationEnvironments is deprecated. Use evaluationContexts instead. This property will be removed in a future version.");
    this.disableCompression = !isGzipSupported() || (options?.disableCompression ?? false);
  }
  logMsgIfDebug(fn) {
    if (this.isDebug)
      fn();
  }
  wrap(fn) {
    if (this.disabled)
      return void this._logger.warn("The client is disabled");
    if (this._isInitialized)
      return fn();
    this._initPromise.then(() => fn());
  }
  getCommonEventProperties() {
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion()
    };
  }
  get optedOut() {
    return this.getPersistedProperty(types_PostHogPersistedProperty.OptedOut) ?? !this.defaultOptIn;
  }
  async optIn() {
    this.wrap(() => {
      this.setPersistedProperty(types_PostHogPersistedProperty.OptedOut, false);
    });
  }
  async optOut() {
    this.wrap(() => {
      this.setPersistedProperty(types_PostHogPersistedProperty.OptedOut, true);
    });
  }
  on(event, cb) {
    return this._events.on(event, cb);
  }
  debug(enabled = true) {
    this.removeDebugCallback?.();
    if (enabled) {
      const removeDebugCallback = this.on("*", (event, payload) => this._logger.info(event, payload));
      this.removeDebugCallback = () => {
        removeDebugCallback();
        this.removeDebugCallback = undefined;
      };
    }
  }
  get isDebug() {
    return !!this.removeDebugCallback;
  }
  get isDisabled() {
    return this.disabled;
  }
  buildPayload(payload) {
    const userProperties = payload.properties || {};
    let properties = this.mergeCommonEventProperties(userProperties);
    applyCallerFeatureFlagOverrides(properties, userProperties);
    if (payload.event === "$feature_flag_called" && properties.$feature_flag_has_experiment === false && this.isMinimalFlagCalledEventsEnabled())
      properties = minimizeFlagCalledEventProperties(properties);
    return {
      distinct_id: payload.distinct_id,
      event: payload.event,
      properties
    };
  }
  mergeCommonEventProperties(properties) {
    return {
      ...properties,
      ...this.getCommonEventProperties()
    };
  }
  isMinimalFlagCalledEventsEnabled() {
    return false;
  }
  addPendingPromise(promise) {
    return this.promiseQueue.add(promise);
  }
  identifyStateless(distinctId, properties, options) {
    this.wrap(() => {
      const payload = {
        ...this.buildPayload({
          distinct_id: distinctId,
          event: "$identify",
          properties
        })
      };
      this.enqueue("identify", payload, options);
    });
  }
  async identifyStatelessImmediate(distinctId, properties, options) {
    const payload = {
      ...this.buildPayload({
        distinct_id: distinctId,
        event: "$identify",
        properties
      })
    };
    await this.sendImmediate("identify", payload, options);
  }
  captureStateless(distinctId, event, properties, options) {
    this.wrap(() => {
      const payload = this.buildPayload({
        distinct_id: distinctId,
        event,
        properties
      });
      this.enqueue("capture", payload, options);
    });
  }
  async captureStatelessImmediate(distinctId, event, properties, options) {
    const payload = this.buildPayload({
      distinct_id: distinctId,
      event,
      properties
    });
    await this.sendImmediate("capture", payload, options);
  }
  aliasStateless(alias, distinctId, properties, options) {
    this.wrap(() => {
      const payload = this.buildPayload({
        event: "$create_alias",
        distinct_id: distinctId,
        properties: {
          ...properties || {},
          distinct_id: distinctId,
          alias
        }
      });
      this.enqueue("alias", payload, options);
    });
  }
  async aliasStatelessImmediate(alias, distinctId, properties, options) {
    const payload = this.buildPayload({
      event: "$create_alias",
      distinct_id: distinctId,
      properties: {
        ...properties || {},
        distinct_id: distinctId,
        alias
      }
    });
    await this.sendImmediate("alias", payload, options);
  }
  groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties) {
    this.wrap(() => {
      const payload = this.buildPayload({
        distinct_id: distinctId || `$${groupType}_${groupKey}`,
        event: "$groupidentify",
        properties: {
          $group_type: groupType,
          $group_key: groupKey,
          $group_set: groupProperties || {},
          ...eventProperties || {}
        }
      });
      this.enqueue("capture", payload, options);
    });
  }
  async groupIdentifyStatelessImmediate(groupType, groupKey, groupProperties, options, distinctId, eventProperties) {
    const payload = this.buildPayload({
      distinct_id: distinctId || `$${groupType}_${groupKey}`,
      event: "$groupidentify",
      properties: {
        $group_type: groupType,
        $group_key: groupKey,
        $group_set: groupProperties || {},
        ...eventProperties || {}
      }
    });
    await this.sendImmediate("capture", payload, options);
  }
  async getRemoteConfig() {
    await this._initPromise;
    let host = this.host;
    if (host === "https://us.i.posthog.com")
      host = "https://us-assets.i.posthog.com";
    else if (host === "https://eu.i.posthog.com")
      host = "https://eu-assets.i.posthog.com";
    const url = `${host}/array/${this.projectToken}/config`;
    const fetchOptions = {
      method: "GET",
      headers: {
        ...this.getCustomHeaders(),
        "Content-Type": "application/json"
      }
    };
    return this.fetchWithRetry(url, fetchOptions, {
      type: "required",
      consume: (response) => response.json()
    }, {
      retryCount: 0
    }, this.remoteConfigRequestTimeoutMs).catch((error) => {
      this._logger.error("Remote config could not be loaded", error);
      this._events.emit("error", error);
    });
  }
  async getFlags(distinctId, groups = {}, personProperties = {}, groupProperties = {}, extraPayload = {}, fetchConfig = false) {
    await this._initPromise;
    const configParam = fetchConfig ? "&config=true" : "";
    const url = `${this.host}/flags/?v=2${configParam}`;
    const requestData = {
      token: this.projectToken,
      distinct_id: distinctId,
      groups,
      person_properties: personProperties,
      group_properties: groupProperties,
      ...extraPayload
    };
    if (personProperties.$device_id)
      requestData.$device_id = personProperties.$device_id;
    if (this.evaluationContexts && this.evaluationContexts.length > 0)
      requestData.evaluation_contexts = this.evaluationContexts;
    const evaluationRuntime = this.getEvaluationRuntime();
    if (evaluationRuntime)
      requestData.evaluation_runtime = evaluationRuntime;
    const fetchOptions = {
      method: "POST",
      headers: {
        ...this.getCustomHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestData)
    };
    this._logger.info("Flags URL", url);
    return this.fetchWithRetry(url, fetchOptions, {
      type: "required",
      consume: (response) => response.json()
    }, {
      retryCount: this.featureFlagsRequestMaxRetries,
      retryCheck: isRetryableFlagsFetchError
    }, this.featureFlagsRequestTimeoutMs).then((response) => ({
      success: true,
      response: normalizeFlagsResponse(response)
    })).catch((error) => {
      this._events.emit("error", error);
      return {
        success: false,
        error: this.categorizeRequestError(error)
      };
    });
  }
  categorizeRequestError(error) {
    if (error instanceof PostHogFetchHttpError)
      return {
        type: "api_error",
        statusCode: error.status
      };
    if (error instanceof PostHogFetchNetworkError) {
      const cause = error.error;
      if (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError"))
        return {
          type: "timeout"
        };
      return {
        type: "connection_error"
      };
    }
    return {
      type: "unknown_error"
    };
  }
  async getFeatureFlagStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
    await this._initPromise;
    const flagDetailResponse = await this.getFeatureFlagDetailStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
    if (flagDetailResponse === undefined)
      return {
        response: undefined,
        requestId: undefined
      };
    let response = getFeatureFlagValue(flagDetailResponse.response);
    if (response === undefined)
      response = false;
    return {
      response,
      requestId: flagDetailResponse.requestId
    };
  }
  async getFeatureFlagDetailStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
    await this._initPromise;
    const flagsResponse = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [
      key
    ]);
    if (flagsResponse === undefined)
      return;
    const featureFlags = flagsResponse.flags;
    const flagDetail = featureFlags[key];
    return {
      response: flagDetail,
      requestId: flagsResponse.requestId,
      evaluatedAt: flagsResponse.evaluatedAt
    };
  }
  async getFeatureFlagPayloadStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
    await this._initPromise;
    const payloads = await this.getFeatureFlagPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [
      key
    ]);
    if (!payloads)
      return;
    const response = payloads[key];
    if (response === undefined)
      return null;
    return response;
  }
  async getFeatureFlagPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
    await this._initPromise;
    const payloads = (await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate)).payloads;
    return payloads;
  }
  async getFeatureFlagsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
    await this._initPromise;
    return await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
  }
  async getFeatureFlagsAndPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
    await this._initPromise;
    const featureFlagDetails = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
    if (!featureFlagDetails)
      return {
        flags: undefined,
        payloads: undefined,
        requestId: undefined
      };
    return {
      flags: featureFlagDetails.featureFlags,
      payloads: featureFlagDetails.featureFlagPayloads,
      requestId: featureFlagDetails.requestId
    };
  }
  async getFeatureFlagDetailsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
    await this._initPromise;
    const extraPayload = {
      geoip_disable: disableGeoip ?? this.disableGeoip
    };
    if (flagKeysToEvaluate)
      extraPayload["flag_keys_to_evaluate"] = flagKeysToEvaluate;
    const result = await this.getFlags(distinctId, groups, personProperties, groupProperties, extraPayload);
    if (!result.success)
      return;
    const flagsResponse = result.response;
    if (flagsResponse.errorsWhileComputingFlags)
      console.error("[FEATURE FLAGS] Error while computing feature flags, some flags may be missing or incorrect. Learn more at https://posthog.com/docs/feature-flags/best-practices");
    if (flagsResponse.quotaLimited?.includes("feature_flags")) {
      console.warn("[FEATURE FLAGS] Feature flags quota limit exceeded - feature flags unavailable. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts");
      return {
        flags: {},
        featureFlags: {},
        featureFlagPayloads: {},
        requestId: flagsResponse?.requestId,
        quotaLimited: flagsResponse.quotaLimited
      };
    }
    return flagsResponse;
  }
  async getSurveysStateless() {
    await this._initPromise;
    if (this.disabled)
      return [];
    if (this.disableSurveys === true) {
      this._logger.info("Loading surveys is disabled.");
      return [];
    }
    const url = `${this.host}/api/surveys/?token=${this.projectToken}`;
    const fetchOptions = {
      method: "GET",
      headers: {
        ...this.getCustomHeaders(),
        "Content-Type": "application/json"
      }
    };
    const response = await this.fetchWithRetry(url, fetchOptions, {
      type: "required",
      consume: (response) => {
        if (response.status !== 200 || !response.json) {
          const msg = `Surveys API could not be loaded: ${response.status}`;
          const error = new Error(msg);
          this._logger.error(error);
          this._events.emit("error", new Error(msg));
          return Promise.resolve(undefined);
        }
        return response.json();
      }
    }).catch((error) => {
      this._logger.error("Surveys API could not be loaded", error);
      this._events.emit("error", error);
    });
    const newSurveys = response?.surveys;
    if (newSurveys)
      this._logger.info("Surveys fetched from API: ", JSON.stringify(newSurveys));
    return newSurveys ?? [];
  }
  get props() {
    if (!this._props)
      this._props = this.getPersistedProperty(types_PostHogPersistedProperty.Props);
    return this._props || {};
  }
  set props(val) {
    this._props = val;
  }
  async register(properties) {
    this.wrap(() => {
      this.props = {
        ...this.props,
        ...properties
      };
      this.setPersistedProperty(types_PostHogPersistedProperty.Props, this.props);
    });
  }
  async unregister(property) {
    this.wrap(() => {
      delete this.props[property];
      this.setPersistedProperty(types_PostHogPersistedProperty.Props, this.props);
    });
  }
  processBeforeEnqueue(message) {
    return message;
  }
  async flushStorage() {}
  getQueueRouteKey(_message) {
    return DEFAULT_QUEUE_ROUTE;
  }
  persistedQueueKeyForRoute(_route) {
    return types_PostHogPersistedProperty.Queue;
  }
  getActiveQueueRoutes() {
    return [
      DEFAULT_QUEUE_ROUTE
    ];
  }
  getRouteQueue(route) {
    return this.getPersistedProperty(this.persistedQueueKeyForRoute(route)) || [];
  }
  enqueue(type, _message, options, explicitRoute) {
    this.wrap(() => {
      if (this.optedOut)
        return void this._events.emit(type, "Library is disabled. Not sending event. To re-enable, call posthog.optIn()");
      let message = this.prepareMessage(_message, options);
      message = this.processBeforeEnqueue(message);
      if (message === null)
        return;
      message = this.normalizeMessage(message);
      const queueKey = this.persistedQueueKeyForRoute(explicitRoute ?? this.getQueueRouteKey(message));
      const queue = this.getPersistedProperty(queueKey) || [];
      if (queue.length >= this.maxQueueSize) {
        queue.shift();
        this._logger.warn("Queue is full, the oldest event is dropped.");
      }
      queue.push({
        message
      });
      this.setPersistedProperty(queueKey, queue);
      this._events.emit(type, message);
      if (queue.length >= this.flushAt)
        this.flushBackground();
      if (this.flushInterval && !this._flushTimer)
        this._flushTimer = safeSetTimeout(() => this.flushBackground(), this.flushInterval);
    });
  }
  async sendImmediate(type, _message, options, explicitRoute) {
    if (this.disabled)
      return void this._logger.warn("The client is disabled");
    if (!this._isInitialized)
      await this._initPromise;
    if (this.optedOut)
      return void this._events.emit(type, "Library is disabled. Not sending event. To re-enable, call posthog.optIn()");
    let message = this.prepareMessage(_message, options);
    message = this.processBeforeEnqueue(message);
    if (message === null)
      return;
    message = this.normalizeMessage(message);
    try {
      await this.sendBatch([
        message
      ], undefined, explicitRoute ?? this.getQueueRouteKey(message));
    } catch (err) {
      this._events.emit("error", err);
    }
  }
  normalizeMessage(message) {
    const { type: _type, library, library_version, ...sanitizedMessage } = message;
    let properties = isPostHogEventProperties(sanitizedMessage.properties) ? sanitizedMessage.properties : undefined;
    if (library !== undefined && properties?.$lib === undefined)
      properties = {
        ...properties || {},
        $lib: library
      };
    if (library_version !== undefined && properties?.$lib_version === undefined)
      properties = {
        ...properties || {},
        $lib_version: library_version
      };
    if (properties)
      sanitizedMessage.properties = properties;
    sanitizedMessage.uuid = getEventUuid(sanitizedMessage.uuid, uuidv7);
    return sanitizedMessage;
  }
  normalizeTimestampForWire(timestamp) {
    const parsedTimestamp = timestamp instanceof Date ? timestamp : typeof timestamp == "string" ? new Date(timestamp) : null;
    if (!parsedTimestamp || Number.isNaN(parsedTimestamp.getTime()))
      return timestamp;
    const normalized = parsedTimestamp.toISOString();
    const fractionalSeconds = typeof timestamp == "string" ? timestamp.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})?$/i)?.[1] : undefined;
    return fractionalSeconds && fractionalSeconds.length > 3 ? normalized.replace(/\.\d{3}Z$/, `.${fractionalSeconds}Z`) : normalized;
  }
  prepareMessage(_message, options) {
    const message = {
      ..._message,
      timestamp: options?.timestamp ? options?.timestamp : currentISOTime(),
      uuid: getEventUuid(options?.uuid, uuidv7)
    };
    const addGeoipDisableProperty = options?.disableGeoip ?? this.disableGeoip;
    if (addGeoipDisableProperty) {
      if (!isPostHogEventProperties(message.properties))
        message.properties = {};
      message.properties["$geoip_disable"] = true;
    }
    if (message.distinctId) {
      message.distinct_id = message.distinctId;
      delete message.distinctId;
    }
    return message;
  }
  clearFlushTimer() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = undefined;
    }
  }
  flushBackground() {
    if (this.pendingFlushPromise)
      return;
    this.flushAutomatic().catch(async (err) => {
      await logFlushError(err);
    });
  }
  flushAutomatic() {
    return this.flush();
  }
  async waitForPendingPromises(maxPromiseId, ignoredPromises = []) {
    const ignoredPendingPromises = ignoredPromises.filter((promise) => !!promise);
    let iteration = 0;
    while (true) {
      const promises = this.promiseQueue.getPromises([
        ...ignoredPendingPromises,
        ...this.flushPromises
      ], maxPromiseId);
      if (promises.length === 0)
        return;
      if (iteration > 0)
        this._logger.debug(`flush() re-checking ${promises.length} pending promise(s) before flushing`);
      await Promise.all(promises.map((promise) => promise.catch(() => {})));
      iteration++;
    }
  }
  flushWithPendingPromises() {
    return this.flushInternal(true);
  }
  flush() {
    return this.flushInternal(false);
  }
  flushInternal(waitForPendingPromises) {
    if (this.disabled)
      return Promise.resolve();
    if (!waitForPendingPromises && this.pendingFlushPromise)
      return this.pendingFlushPromise;
    const previousFlushPromise = this.flushPromise;
    const maxPromiseId = this.promiseQueue.maxId;
    const nextFlushPromise = Promise.resolve().then(() => {
      if (waitForPendingPromises)
        return this.waitForPendingPromises(maxPromiseId, [
          previousFlushPromise,
          nextFlushPromise
        ]);
    }).then(() => allSettled([
      previousFlushPromise
    ])).then(() => {
      if (this.pendingFlushPromise === nextFlushPromise)
        this.pendingFlushPromise = null;
      return this._flush();
    });
    this.pendingFlushPromise = nextFlushPromise;
    this.flushPromise = nextFlushPromise;
    this.flushPromises.add(nextFlushPromise);
    this.addPendingPromise(nextFlushPromise);
    allSettled([
      nextFlushPromise
    ]).then(() => {
      this.flushPromises.delete(nextFlushPromise);
      if (this.pendingFlushPromise === nextFlushPromise)
        this.pendingFlushPromise = null;
      if (this.flushPromise === nextFlushPromise)
        this.flushPromise = null;
    });
    return nextFlushPromise;
  }
  getCustomHeaders() {
    const customUserAgent = this.getCustomUserAgent();
    const headers = {};
    if (customUserAgent && customUserAgent !== "")
      headers["User-Agent"] = customUserAgent;
    return headers;
  }
  compressPayload(payload) {
    return gzipCompress(payload, this.isDebug);
  }
  getBatchEndpointPath(_route) {
    return "/batch/";
  }
  async sendBatch(batchMessages, retryOptions, route = DEFAULT_QUEUE_ROUTE) {
    const data = {
      api_key: this.projectToken,
      batch: batchMessages.map((message) => {
        if (!message)
          return message;
        const timestamp = this.normalizeTimestampForWire(message.timestamp);
        return timestamp === message.timestamp ? message : {
          ...message,
          timestamp
        };
      }),
      sent_at: currentISOTime()
    };
    if (this.historicalMigration)
      data.historical_migration = true;
    const payload = safeJsonStringify(data);
    const url = `${this.host}${this.getBatchEndpointPath(route)}`;
    const gzippedPayload = this.disableCompression ? null : await this.compressPayload(payload);
    const fetchOptions = {
      method: "POST",
      headers: {
        ...this.getCustomHeaders(),
        "Content-Type": "application/json",
        ...gzippedPayload !== null && {
          "Content-Encoding": "gzip"
        }
      },
      body: gzippedPayload || payload
    };
    await this.fetchWithRetry(url, fetchOptions, {
      type: "successful-write"
    }, retryOptions);
  }
  async _flush() {
    this.clearFlushTimer();
    await this._initPromise;
    const routes = this.getActiveQueueRoutes();
    if (!routes.some((route) => this.getRouteQueue(route).length > 0))
      return;
    const sentMessages = [];
    let firstError;
    for (const route of routes)
      try {
        await this._flushRoute(route, sentMessages);
      } catch (err) {
        if (firstError === undefined)
          firstError = err;
      }
    if (firstError !== undefined)
      throw firstError;
    this._events.emit("flush", sentMessages);
  }
  async _flushRoute(route, sentMessages) {
    const queueKey = this.persistedQueueKeyForRoute(route);
    let queue = this.getPersistedProperty(queueKey) || [];
    if (!queue.length)
      return;
    const originalQueueLength = queue.length;
    let sentFromRoute = 0;
    while (queue.length > 0 && sentFromRoute < originalQueueLength) {
      const batchItems = queue.slice(0, this.maxBatchSize);
      const batchMessages = batchItems.map((item) => item.message === undefined ? item.message : this.normalizeMessage(item.message));
      const persistQueueChange = async () => {
        const refreshedQueue = this.getPersistedProperty(queueKey) || [];
        const remainingBatchItems = [
          ...batchItems
        ];
        const newQueue = refreshedQueue.filter((item) => {
          const itemUuid = item.message?.uuid;
          const batchItemIndex = remainingBatchItems.findIndex((batchItem) => batchItem === item || typeof itemUuid == "string" && itemUuid.length > 0 && batchItem.message?.uuid === itemUuid);
          if (batchItemIndex === -1)
            return true;
          remainingBatchItems.splice(batchItemIndex, 1);
          return false;
        });
        this.setPersistedProperty(queueKey, newQueue);
        queue = newQueue;
        this._dequeuedMessagesCount += batchItems.length;
        await this.flushStorage();
      };
      const retryOptions = {
        retryCheck: (err) => {
          if (isPostHogFetchContentTooLargeError(err))
            return false;
          return isPostHogFetchRetryableError(err);
        }
      };
      try {
        await this.sendBatch(batchMessages, retryOptions, route);
      } catch (err) {
        if (isPostHogFetchContentTooLargeError(err) && batchMessages.length > 1) {
          this.maxBatchSize = Math.max(1, Math.floor(batchMessages.length / 2));
          this._logger.warn(`Received 413 when sending batch of size ${batchMessages.length}, reducing batch size to ${this.maxBatchSize}`);
          continue;
        }
        if (!(err instanceof PostHogFetchNetworkError))
          await persistQueueChange();
        this._events.emit("error", err);
        throw err;
      }
      await persistQueueChange();
      sentMessages.push(...batchMessages);
      sentFromRoute += batchMessages.length;
    }
  }
  async _sendOtlpBatch({ path, auth, payload }) {
    if (this.disabled)
      return {
        kind: "fatal",
        error: new Error("The client is disabled")
      };
    let serialized;
    try {
      serialized = JSON.stringify(payload);
    } catch (error) {
      this.logMsgIfDebug(() => console.warn(`[PostHog] Could not serialize a ${path} batch; reporting it as too large`, error));
      return {
        kind: "too-large",
        measuredLocally: true
      };
    }
    const payloadBytes = byteLengthOf(serialized);
    if (payloadBytes > OTLP_MAX_BODY_BYTES) {
      this.logMsgIfDebug(() => console.warn(`[PostHog] Not sending a ${path} batch of ${payloadBytes} bytes: the endpoint accepts at most ${OTLP_MAX_BODY_BYTES}`));
      return {
        kind: "too-large",
        measuredLocally: true
      };
    }
    const url = auth === "bearer" ? `${this.host}/i/v1/${path}` : `${this.host}/i/v1/${path}?token=${encodeURIComponent(this.projectToken)}`;
    const gzippedPayload = this.disableCompression ? null : await this.compressPayload(serialized);
    const body = gzippedPayload || serialized;
    const fetchOptions = {
      method: "POST",
      headers: {
        ...this.getCustomHeaders(),
        "Content-Type": "application/json",
        ...auth === "bearer" && {
          Authorization: `Bearer ${this.projectToken}`
        },
        ...gzippedPayload !== null && {
          "Content-Encoding": "gzip"
        }
      },
      body
    };
    try {
      await this.fetchWithRetry(url, fetchOptions, {
        type: "successful-write"
      }, {
        retryCheck: (err) => {
          if (isPostHogFetchContentTooLargeError(err))
            return false;
          if (err instanceof PostHogFetchHttpError && err.retryAfterMs !== undefined)
            return false;
          return isPostHogFetchRetryableError(err);
        }
      });
      return {
        kind: "ok"
      };
    } catch (err) {
      if (isPostHogFetchContentTooLargeError(err))
        return {
          kind: "too-large"
        };
      if (isPostHogFetchRetryableError(err)) {
        const retryAfterMs = err instanceof PostHogFetchHttpError ? err.retryAfterMs : undefined;
        return {
          kind: "retry-later",
          error: err,
          ...retryAfterMs !== undefined && {
            retryAfterMs
          }
        };
      }
      return {
        kind: "fatal",
        error: err
      };
    }
  }
  async _sendLogsBatch(payload) {
    return this._sendOtlpBatch({
      path: "logs",
      auth: "query-token",
      payload
    });
  }
  async _sendMetricsBatch(payload) {
    return this._sendOtlpBatch({
      path: "metrics",
      auth: "query-token",
      payload
    });
  }
  async _sendTracesBatch(payload) {
    return this._sendOtlpBatch({
      path: "traces",
      auth: "bearer",
      payload
    });
  }
  async fetchWithRetry(url, options, responseHandling, retryOptions, requestTimeout) {
    const body = options.body ? options.body : "";
    const reqByteLength = byteLengthOf(body);
    const retriableOptions = {
      ...this._retryOptions,
      ...retryOptions
    };
    let attempt = 0;
    return await retriable(async () => {
      attempt++;
      const ctrl = new AbortController;
      const timeoutMs = requestTimeout ?? this.requestTimeout;
      const requestDeadline = Date.now() + timeoutMs;
      let timer;
      const deadline = new Promise((_resolve, reject) => {
        timer = safeSetTimeout(() => {
          const timeoutError = createNamedError("AbortError", `Request timed out after ${timeoutMs}ms`);
          reject(timeoutError);
          ctrl.abort(timeoutError);
        }, timeoutMs);
      });
      let res;
      let responseAccepted = false;
      let cancellation;
      const cancelBody = () => cancellation ??= (async () => {
        try {
          await res?.body?.cancel();
        } catch {}
      })();
      try {
        let fetchPromise;
        try {
          fetchPromise = this.fetch(url, {
            signal: ctrl.signal,
            ...options
          });
        } catch (e) {
          throw new PostHogFetchNetworkError(e);
        }
        fetchPromise.then((lateResponse) => {
          if (ctrl.signal.aborted && !responseAccepted)
            Promise.resolve(lateResponse.body?.cancel()).catch(() => {});
        }).catch(() => {});
        try {
          res = await Promise.race([
            fetchPromise,
            deadline
          ]);
          responseAccepted = true;
        } catch (e) {
          throw new PostHogFetchNetworkError(e);
        }
        const isNoCors = options.mode === "no-cors";
        const maxSuccessStatus = responseHandling.type === "successful-write" ? 300 : 400;
        if (!isNoCors && (res.status < 200 || res.status >= maxSuccessStatus))
          throw new PostHogFetchHttpError(res, reqByteLength, requestDeadline, ctrl);
        if (responseHandling.type === "successful-write") {
          try {
            await Promise.race([
              cancelBody(),
              deadline
            ]);
          } catch {}
          return;
        }
        try {
          return await Promise.race([
            responseHandling.consume(res),
            deadline
          ]);
        } catch (e) {
          if (ctrl.signal.aborted)
            throw new PostHogFetchNetworkError(e);
          throw e;
        }
      } finally {
        clearTimeout(timer);
        if (ctrl.signal.aborted && res)
          cancelBody();
      }
    }, {
      ...retriableOptions,
      retryCheck: (error) => {
        const shouldRetry = retriableOptions.retryCheck(error);
        if (shouldRetry && attempt <= retriableOptions.retryCount && error instanceof PostHogFetchHttpError)
          error.cancelResponseBody();
        return shouldRetry;
      }
    });
  }
  async _shutdown(shutdownTimeoutMs = 30000) {
    await this._initPromise;
    let hasTimedOut = false;
    this.clearFlushTimer();
    if (this.disabled)
      return;
    const doShutdown = async () => {
      try {
        await this.promiseQueue.join();
        while (true) {
          const hasQueuedEvents = this.getActiveQueueRoutes().some((route) => this.getRouteQueue(route).length > 0);
          if (!hasQueuedEvents)
            break;
          const dequeuedBeforeFlush = this._dequeuedMessagesCount;
          await this.flush();
          if (hasTimedOut)
            break;
          if (this._dequeuedMessagesCount === dequeuedBeforeFlush) {
            this._logger.warn("Shutdown flush completed but did not send any queued events. Stopping drain to avoid a loop.");
            break;
          }
        }
      } catch (e) {
        if (!isPostHogFetchError(e))
          throw e;
        await logFlushError(e);
      }
    };
    return raceWithTimeout(doShutdown(), shutdownTimeoutMs, () => {
      this._logger.critical("Timeout while shutting down PostHog. Some events may not have been sent.", {
        shutdownTimeoutMs
      });
      hasTimedOut = true;
    });
  }
  async shutdown(shutdownTimeoutMs = 30000) {
    if (this.shutdownPromise)
      this._logger.warn("shutdown() called while already shutting down. shutdown() is meant to be called once before process exit - use flush() for per-request cleanup");
    else
      this.shutdownPromise = this._shutdown(shutdownTimeoutMs).finally(() => {
        this.shutdownPromise = null;
      });
    return this.shutdownPromise;
  }
}
var PostHogFetchHttpError, PostHogFetchNetworkError, applyCallerFeatureFlagOverrides = (target, callerProperties) => {
  for (const key of Object.keys(callerProperties))
    if (key.startsWith("$feature/") || key === "$active_feature_flags")
      target[key] = callerProperties[key];
}, OTLP_MAX_BODY_BYTES = 10485760, DEFAULT_QUEUE_ROUTE = "default";
var init_posthog_core_stateless = __esm(() => {
  init_eventemitter();
  init_featureFlagUtils();
  init_gzip();
  init_types();
  init_utils();
  init_retry_after();
  init_uuidv7();
  init_error_tracking();
  PostHogFetchHttpError = class PostHogFetchHttpError extends Error {
    constructor(response, reqByteLength, responseBodyDeadline, abortController) {
      super("HTTP error while fetching PostHog: status=" + response.status + ", reqByteLength=" + reqByteLength), this.response = response, this.reqByteLength = reqByteLength, this.responseBodyDeadline = responseBodyDeadline, this.abortController = abortController, this.name = "PostHogFetchHttpError", this._bodyReadTimedOut = false;
    }
    get status() {
      return this.response.status;
    }
    get retryAfterMs() {
      try {
        return parseRetryAfterMs(this.response.headers?.get("retry-after"));
      } catch {
        return;
      }
    }
    get bodyReadTimedOut() {
      return this._bodyReadTimedOut;
    }
    get text() {
      if (!this.responseBodyTextPromise)
        if (Date.now() >= this.responseBodyDeadline) {
          this._bodyReadTimedOut = true;
          const timeoutError = createNamedError("AbortError", "Response body read timed out");
          this.cancelResponseBody(timeoutError);
          this.responseBodyTextPromise = Promise.reject(timeoutError);
        } else {
          const responseBodyTimeout = new Promise((_resolve, reject) => {
            this.responseBodyTimer = safeSetTimeout(() => {
              this._bodyReadTimedOut = true;
              const timeoutError = createNamedError("AbortError", "Response body read timed out");
              reject(timeoutError);
              this.cancelResponseBody(timeoutError);
            }, this.responseBodyDeadline - Date.now());
          });
          let responseBodyText;
          try {
            responseBodyText = Promise.resolve(this.response.text());
          } catch (error) {
            responseBodyText = Promise.reject(error);
          }
          this.responseBodyTextPromise = Promise.race([
            responseBodyText,
            responseBodyTimeout
          ]).finally(() => clearTimeout(this.responseBodyTimer));
        }
      return this.responseBodyTextPromise;
    }
    get json() {
      return this.text.then((text) => JSON.parse(text));
    }
    cancelResponseBody(reason) {
      clearTimeout(this.responseBodyTimer);
      if (!this.abortController.signal.aborted)
        this.abortController.abort(reason);
      (async () => {
        try {
          await this.response.body?.cancel();
        } catch {}
      })();
    }
  };
  PostHogFetchNetworkError = class PostHogFetchNetworkError extends Error {
    constructor(error) {
      super("Network error while fetching PostHog", error instanceof Error ? {
        cause: error
      } : {}), this.error = error, this.name = "PostHogFetchNetworkError";
    }
  };
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/posthog-core.mjs
var init_posthog_core = __esm(() => {
  init_featureFlagUtils();
  init_types();
  init_posthog_core_stateless();
  init_uuidv7();
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/privacy.mjs
var init_privacy = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/tracing-headers.mjs
var init_tracing_headers = __esm(() => {
  init_type_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/featureFlagLocalEvaluation.mjs
function readContextValue(read) {
  try {
    return read();
  } catch (e) {
    if (e instanceof InconclusiveMatchError)
      throw new InconclusiveMatchError(e.message, "missing_context");
    throw e;
  }
}
function isTruthyOrFalsyPropertyValue(value) {
  if (typeof value == "boolean")
    return true;
  if (typeof value == "string") {
    const lowercaseValue = value.toLowerCase();
    return lowercaseValue === "true" || lowercaseValue === "false";
  }
  if (!Array.isArray(value))
    return false;
  for (let index = 0;index < value.length; index++)
    if (!isTruthyOrFalsyPropertyValue(index in value ? value[index] : null))
      return false;
  return true;
}
function isTruthyPropertyValue(value) {
  if (typeof value == "boolean")
    return value;
  if (typeof value == "string")
    return value.toLowerCase() === "true";
  if (!Array.isArray(value))
    return false;
  for (let index = 0;index < value.length; index++)
    if (!isTruthyPropertyValue(index in value ? value[index] : null))
      return false;
  return true;
}
function assertUnicodeScalarString(value) {
  for (let index = 0;index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 55296 && unit <= 56319) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 56320 || next > 57343)
        throw new InconclusiveMatchError("Cannot stringify an unpaired surrogate like the flags service");
      index++;
    } else if (unit >= 56320 && unit <= 57343)
      throw new InconclusiveMatchError("Cannot stringify an unpaired surrogate like the flags service");
  }
}
function assertJsonRepresentable(value, seen = new Set) {
  if (value === null || typeof value == "boolean")
    return;
  if (typeof value == "string")
    return void assertUnicodeScalarString(value);
  if (typeof value == "number") {
    if (!Number.isFinite(value))
      throw new InconclusiveMatchError(`Cannot represent non-finite number ${value} like the flags service`);
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value))
      throw new InconclusiveMatchError("Cannot represent a circular array during local evaluation");
    seen.add(value);
    try {
      for (let index = 0;index < value.length; index++)
        if (index in value)
          assertJsonRepresentable(value[index], seen);
    } finally {
      seen.delete(value);
    }
    return;
  }
  if (typeof value == "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new InconclusiveMatchError("Cannot represent a non-JSON object like the flags service");
    if (seen.has(value))
      throw new InconclusiveMatchError("Cannot represent a circular object during local evaluation");
    seen.add(value);
    try {
      for (const key of Object.keys(value)) {
        assertUnicodeScalarString(key);
        assertJsonRepresentable(value[key], seen);
      }
    } finally {
      seen.delete(value);
    }
    return;
  }
  throw new InconclusiveMatchError(`Cannot represent ${typeof value} like the flags service`);
}
function compareJsonObjectKeys(left, right) {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftUnit = left.charCodeAt(leftIndex);
    const rightUnit = right.charCodeAt(rightIndex);
    const leftIsHighSurrogate = leftUnit >= 55296 && leftUnit <= 56319;
    const rightIsHighSurrogate = rightUnit >= 55296 && rightUnit <= 56319;
    const leftNext = leftIsHighSurrogate ? left.charCodeAt(leftIndex + 1) : 0;
    const rightNext = rightIsHighSurrogate ? right.charCodeAt(rightIndex + 1) : 0;
    const leftCodePoint = leftIsHighSurrogate ? (leftUnit - 55296) * 1024 + leftNext - 56320 + 65536 : leftUnit;
    const rightCodePoint = rightIsHighSurrogate ? (rightUnit - 55296) * 1024 + rightNext - 56320 + 65536 : rightUnit;
    if (leftCodePoint !== rightCodePoint)
      return leftCodePoint - rightCodePoint;
    leftIndex += leftIsHighSurrogate ? 2 : 1;
    rightIndex += rightIsHighSurrogate ? 2 : 1;
  }
  return left.length - right.length;
}
function serializeJsonValue(value, seen = new Set) {
  if (value === null)
    return "null";
  if (typeof value == "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value == "boolean")
    return value ? "true" : "false";
  if (typeof value == "number") {
    if (!Number.isFinite(value))
      throw new InconclusiveMatchError(`Cannot stringify non-finite number ${value} like the flags service`);
    if (Number.isInteger(value))
      throw new InconclusiveMatchError(`Cannot distinguish integer ${value} from an integral JSON float during local evaluation`);
    return String(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value))
      throw new InconclusiveMatchError("Cannot stringify a circular array during local evaluation");
    seen.add(value);
    try {
      const items = [];
      for (let index = 0;index < value.length; index++)
        items.push(index in value ? serializeJsonValue(value[index], seen) : "null");
      return `[${items.join(",")}]`;
    } finally {
      seen.delete(value);
    }
  }
  if (typeof value == "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new InconclusiveMatchError("Cannot stringify a non-JSON object like the flags service");
    if (seen.has(value))
      throw new InconclusiveMatchError("Cannot stringify a circular object during local evaluation");
    seen.add(value);
    try {
      const keys = Object.keys(value);
      keys.forEach(assertUnicodeScalarString);
      return `{${keys.sort(compareJsonObjectKeys).map((key) => `${JSON.stringify(key)}:${serializeJsonValue(value[key], seen)}`).join(",")}}`;
    } finally {
      seen.delete(value);
    }
  }
  throw new InconclusiveMatchError(`Cannot stringify ${typeof value} like the flags service`);
}
function exactMatchString(value) {
  if (typeof value == "string") {
    assertUnicodeScalarString(value);
    return value;
  }
  return serializeJsonValue(value);
}
function getPortableRegexClasses(pattern) {
  const classes = [];
  let classStart = -1;
  let previousToken = "";
  for (let index = 0;index < pattern.length; index++) {
    const character = pattern[index];
    if (character.charCodeAt(0) > 127)
      return null;
    if (character === "\\") {
      const escaped = pattern[++index];
      if (escaped === undefined)
        break;
      if (escaped === "x") {
        if (!/^[\da-f]{2}$/i.test(pattern.slice(index + 1, index + 3)))
          return null;
        index += 2;
      } else if (!"dDsSwWbBfnrtv".includes(escaped) && !LITERAL_ESCAPED_PUNCTUATION.test(escaped))
        return null;
      if (classStart === -1 && "bB".includes(escaped))
        return null;
      previousToken = "literal";
      continue;
    }
    if (character === "[") {
      if (classStart !== -1)
        return null;
      classStart = index;
    } else if (character === "]" && classStart !== -1) {
      const contentStart = classStart + (pattern[classStart + 1] === "^" ? 2 : 1);
      if (index === contentStart)
        return null;
      classes.push(pattern.slice(classStart, index + 1));
      classStart = -1;
      previousToken = "literal";
      continue;
    } else if (classStart !== -1) {
      if ([
        "&&",
        "--",
        "~~"
      ].includes(pattern.slice(index, index + 2)))
        return null;
      continue;
    } else if (character === "(" && pattern[index + 1] === "?") {
      if (pattern[index + 2] !== ":")
        return null;
      index += 2;
    } else if (character === "{") {
      const repetition = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(index));
      if (!repetition || [
        "",
        "|",
        "("
      ].includes(previousToken) || repetition.slice(1).some((count) => Number(count) > 4294967295))
        return null;
    } else if ("*+?}".includes(character) && (pattern[index + 1] === "+" || pattern[index + 1] === "{"))
      return null;
    if ("*+?{".includes(character) && [
      "^",
      "$",
      "empty group"
    ].includes(previousToken))
      return null;
    previousToken = character === ")" && [
      "(",
      "empty group"
    ].includes(previousToken) ? "empty group" : character;
  }
  return classes;
}
function regexRequiresServerEvaluation(message) {
  const error = new InconclusiveMatchError(message);
  Object.defineProperty(error, Symbol.for("posthog.requiresServerRegexEvaluation"), {
    value: true
  });
  return error;
}
function matchFeatureFlagRegex(pattern, value) {
  if (pattern === "")
    return true;
  const characterClasses = getPortableRegexClasses(pattern);
  if (characterClasses === null)
    throw regexRequiresServerEvaluation("Regex syntax requires server evaluation");
  let regex;
  try {
    regex = new RegExp(pattern);
  } catch (error) {
    if (error instanceof SyntaxError)
      return null;
    throw regexRequiresServerEvaluation("Regex compilation requires server evaluation");
  }
  for (const characterClass of characterClasses)
    try {
      new RegExp(characterClass, "u");
    } catch {
      throw regexRequiresServerEvaluation("Regex character class syntax requires server evaluation");
    }
  for (let index = 0;index < value.length; index++) {
    const character = value[index];
    if (character.charCodeAt(0) > 127 || character === "\r")
      throw regexRequiresServerEvaluation("Regex matching for Unicode or carriage returns requires server evaluation");
  }
  try {
    return regex.test(value);
  } catch {
    throw regexRequiresServerEvaluation("Regex execution requires server evaluation");
  }
}
function asciiLowercase(value) {
  return String(value).replace(/[A-Z]/g, (character) => character.toLowerCase());
}
function parseSemverNumericIdentifier(part, raw, parsingPolicy) {
  if (!/^\d+$/.test(part) || parsingPolicy === "strict" && part.length > 1 && part[0] === "0")
    throw new InconclusiveMatchError(`Invalid semver: ${raw}`);
  return parseInt(part, 10);
}
function parseFeatureFlagSemver(value, parsingPolicy = "strict") {
  const text = String(value).trim().replace(/^[vV]/, "");
  const baseVersion = text.split("-")[0].split("+")[0];
  if (!baseVersion || baseVersion.startsWith("."))
    throw new InconclusiveMatchError(`Invalid semver: ${value}`);
  const parts = baseVersion.split(".");
  const parsePart = (part) => {
    if (part === undefined || part === "")
      return 0;
    return parseSemverNumericIdentifier(part, value, parsingPolicy);
  };
  return [
    parsePart(parts[0]),
    parsePart(parts[1]),
    parsePart(parts[2])
  ];
}
function compareSemverTuples(a, b) {
  for (let i = 0;i < 3; i++) {
    if (a[i] < b[i])
      return -1;
    if (a[i] > b[i])
      return 1;
  }
  return 0;
}
function computeTildeBounds(value, parsingPolicy) {
  const parsed = parseFeatureFlagSemver(value, parsingPolicy);
  return {
    lower: [
      parsed[0],
      parsed[1],
      parsed[2]
    ],
    upper: [
      parsed[0],
      parsed[1] + 1,
      0
    ]
  };
}
function computeCaretBounds(value, parsingPolicy) {
  const [major, minor, patch] = parseFeatureFlagSemver(value, parsingPolicy);
  const lower = [
    major,
    minor,
    patch
  ];
  let upper;
  upper = major > 0 ? [
    major + 1,
    0,
    0
  ] : minor > 0 ? [
    0,
    minor + 1,
    0
  ] : [
    0,
    0,
    patch + 1
  ];
  return {
    lower,
    upper
  };
}
function computeWildcardBounds(value, parsingPolicy) {
  const text = String(value).trim().replace(/^[vV]/, "");
  const cleanedText = text.replace(/\.\*$/, "").replace(/\*$/, "");
  if (!cleanedText)
    throw new InconclusiveMatchError(`Invalid wildcard semver: ${value}`);
  const parts = cleanedText.split(".");
  const parseWildcardPart = (part) => {
    if (parsingPolicy === "legacy-permissive") {
      const parsed = parseInt(part, 10);
      if (!isNaN(parsed))
        return parsed;
    } else
      try {
        return parseSemverNumericIdentifier(part, value, parsingPolicy);
      } catch {}
    throw new InconclusiveMatchError(`Invalid wildcard semver: ${value}`);
  };
  const major = parseWildcardPart(parts[0]);
  if (parts.length === 1)
    return {
      lower: [
        major,
        0,
        0
      ],
      upper: [
        major + 1,
        0,
        0
      ]
    };
  const minor = parseWildcardPart(parts[1]);
  return {
    lower: [
      major,
      minor,
      0
    ],
    upper: [
      major,
      minor + 1,
      0
    ]
  };
}
function convertToDateTime(value) {
  if (value instanceof Date)
    return value;
  if (typeof value == "string" || typeof value == "number") {
    const date = new Date(value);
    if (!isNaN(date.valueOf()))
      return date;
    throw new InconclusiveMatchError(`${value} is in an invalid date format`);
  }
  throw new InconclusiveMatchError(`The date provided ${value} must be a string, number, or date object`);
}
function relativeDateParseForFeatureFlagMatching(value) {
  const regex = /^-?(?<number>[0-9]+)(?<interval>[a-z])$/;
  const match = value.match(regex);
  const parsedDt = new Date(new Date().toISOString());
  if (!match || !match.groups)
    return null;
  const number = parseInt(match.groups["number"]);
  if (number >= 1e4)
    return null;
  const interval = match.groups["interval"];
  if (interval === "h")
    parsedDt.setUTCHours(parsedDt.getUTCHours() - number);
  else if (interval === "d")
    parsedDt.setUTCDate(parsedDt.getUTCDate() - number);
  else if (interval === "w")
    parsedDt.setUTCDate(parsedDt.getUTCDate() - 7 * number);
  else if (interval === "m")
    parsedDt.setUTCMonth(parsedDt.getUTCMonth() - number);
  else {
    if (interval !== "y")
      return null;
    parsedDt.setUTCFullYear(parsedDt.getUTCFullYear() - number);
  }
  return parsedDt;
}
function parseDateFilter(value) {
  if (typeof value == "boolean")
    throw new InconclusiveMatchError("Date operations cannot be performed on boolean values");
  return relativeDateParseForFeatureFlagMatching(String(value)) ?? convertToDateTime(value);
}
function assertFeatureFlagFilterSupported(property, options = {}) {
  const value = property.value;
  const parsingPolicy = options.semverParsingPolicy ?? "strict";
  switch (property.operator || "exact") {
    case "exact":
    case "is_not":
      for (const item of Array.isArray(value) ? value : [
        value
      ])
        exactMatchString(item);
      return;
    case "is_set":
    case "is_not_set":
    case "icontains":
    case "not_icontains":
    case "starts_with":
    case "not_starts_with":
    case "ends_with":
    case "not_ends_with":
    case "regex":
    case "not_regex":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return;
    case "is_date_after":
    case "is_date_before":
      parseDateFilter(value);
      return;
    case "semver_eq":
    case "semver_neq":
    case "semver_gt":
    case "semver_gte":
    case "semver_lt":
    case "semver_lte":
      parseFeatureFlagSemver(String(value), parsingPolicy);
      return;
    case "semver_tilde":
      computeTildeBounds(String(value), parsingPolicy);
      return;
    case "semver_caret":
      computeCaretBounds(String(value), parsingPolicy);
      return;
    case "semver_wildcard":
      computeWildcardBounds(String(value), parsingPolicy);
      return;
    default:
      throw new InconclusiveMatchError(`Unknown operator: ${property.operator}`);
  }
}
function matchFeatureFlagProperty(property, propertyValues, options = {}) {
  try {
    return matchPropertyValue(property, propertyValues, options);
  } catch (e) {
    if (e instanceof InconclusiveMatchError && e.reason === "missing_context")
      assertFeatureFlagFilterSupported(property, options);
    throw e;
  }
}
function matchPropertyValue(property, propertyValues, options) {
  const key = property.key;
  const value = property.value;
  const operator = property.operator || "exact";
  const parsingPolicy = options.semverParsingPolicy ?? "strict";
  const hasProperty = Object.prototype.hasOwnProperty.call(propertyValues, key);
  if (hasProperty) {
    if (operator === "is_not_set")
      return false;
    else if (operator === "is_set")
      return true;
  } else
    throw new InconclusiveMatchError(`Property ${key} not found in propertyValues`, "missing_context");
  const overrideValue = propertyValues[key];
  if (overrideValue === undefined) {
    options.warnFunction?.(`Property ${key} cannot have a value of undefined with the ${operator} operator`);
    throw new InconclusiveMatchError(`Property ${key} is undefined in propertyValues`);
  }
  if (overrideValue === null && !NULL_VALUES_ALLOWED_OPERATORS.includes(operator)) {
    options.warnFunction?.(`Property ${key} cannot have a value of null with the ${operator} operator`);
    return false;
  }
  const computeExactMatch = (target, actual) => {
    if (options.propertyMatchingVersion !== 2 && isTruthyOrFalsyPropertyValue(target) || Array.isArray(target) && target.length === 0) {
      readContextValue(() => assertJsonRepresentable(actual));
      return isTruthyPropertyValue(target) === isTruthyPropertyValue(actual);
    }
    if (options.propertyMatchingVersion === 2 && typeof actual == "number" && isTruthyOrFalsyPropertyValue(target)) {
      readContextValue(() => assertJsonRepresentable(actual));
      return false;
    }
    if (Array.isArray(target)) {
      const actualString = readContextValue(() => exactMatchString(actual)).toLowerCase();
      return target.some((item) => exactMatchString(item).toLowerCase() === actualString);
    }
    const targetString = exactMatchString(target).toLowerCase();
    return targetString === readContextValue(() => exactMatchString(actual)).toLowerCase();
  };
  const compare = (lhs, rhs, comparisonOperator) => {
    if (comparisonOperator === "gt")
      return lhs > rhs;
    if (comparisonOperator === "gte")
      return lhs >= rhs;
    if (comparisonOperator === "lt")
      return lhs < rhs;
    if (comparisonOperator === "lte")
      return lhs <= rhs;
    throw new Error(`Invalid operator: ${comparisonOperator}`);
  };
  const parseContextSemver = () => readContextValue(() => parseFeatureFlagSemver(String(overrideValue), parsingPolicy));
  const compareContextSemverToFilter = () => {
    const filterParsed = parseFeatureFlagSemver(String(value), parsingPolicy);
    return compareSemverTuples(parseContextSemver(), filterParsed);
  };
  const isContextSemverWithin = ({ lower, upper }) => {
    const overrideParsed = parseContextSemver();
    return compareSemverTuples(overrideParsed, lower) >= 0 && compareSemverTuples(overrideParsed, upper) < 0;
  };
  switch (operator) {
    case "exact":
      return computeExactMatch(value, overrideValue);
    case "is_not":
      return !computeExactMatch(value, overrideValue);
    case "is_set":
      return true;
    case "icontains":
      return asciiLowercase(overrideValue).includes(asciiLowercase(value));
    case "not_icontains":
      return !asciiLowercase(overrideValue).includes(asciiLowercase(value));
    case "starts_with":
      return asciiLowercase(overrideValue).startsWith(asciiLowercase(value));
    case "not_starts_with":
      return !asciiLowercase(overrideValue).startsWith(asciiLowercase(value));
    case "ends_with":
      return asciiLowercase(overrideValue).endsWith(asciiLowercase(value));
    case "not_ends_with":
      return !asciiLowercase(overrideValue).endsWith(asciiLowercase(value));
    case "regex":
    case "not_regex": {
      const matched = matchFeatureFlagRegex(String(value), String(overrideValue));
      if (matched === null)
        return false;
      return operator === "regex" ? matched : !matched;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const parsedValue = typeof value == "number" ? value : parseFloat(String(value));
      const parsedOverride = typeof overrideValue == "number" ? overrideValue : overrideValue != null ? parseFloat(String(overrideValue)) : 0 / 0;
      if (Number.isFinite(parsedValue) && Number.isFinite(parsedOverride))
        return compare(parsedOverride, parsedValue, operator);
      return compare(String(overrideValue), String(value), operator);
    }
    case "is_date_after":
    case "is_date_before": {
      const parsedDate = parseDateFilter(value);
      const overrideDate = readContextValue(() => convertToDateTime(overrideValue));
      return operator === "is_date_before" ? overrideDate < parsedDate : overrideDate > parsedDate;
    }
    case "semver_eq":
      return compareContextSemverToFilter() === 0;
    case "semver_neq":
      return compareContextSemverToFilter() !== 0;
    case "semver_gt":
      return compareContextSemverToFilter() > 0;
    case "semver_gte":
      return compareContextSemverToFilter() >= 0;
    case "semver_lt":
      return compareContextSemverToFilter() < 0;
    case "semver_lte":
      return compareContextSemverToFilter() <= 0;
    case "semver_tilde":
      return isContextSemverWithin(computeTildeBounds(String(value), parsingPolicy));
    case "semver_caret":
      return isContextSemverWithin(computeCaretBounds(String(value), parsingPolicy));
    case "semver_wildcard":
      return isContextSemverWithin(computeWildcardBounds(String(value), parsingPolicy));
    default:
      throw new InconclusiveMatchError(`Unknown operator: ${operator}`);
  }
}
async function hashSHA1(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle)
    throw new Error("SubtleCrypto API not available");
  const hashBuffer = await subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function getFeatureFlagHash(key, bucketingValue, salt = "", separator = ".") {
  const hashString = await hashSHA1(`${key}${separator}${bucketingValue}${salt}`);
  return parseInt(hashString.slice(0, 15), 16) / LONG_SCALE;
}
async function getHoldoutVariant(holdout, bucketingValue) {
  if (holdout == null || holdout.id == null || holdout.exclusion_percentage == null)
    return;
  const rawPercentage = Number(holdout.exclusion_percentage);
  if (!Number.isFinite(rawPercentage))
    return;
  const percentage = Math.min(Math.max(rawPercentage, 0), 100);
  if (percentage !== 100) {
    const hash = await getFeatureFlagHash("holdout", bucketingValue, "", "-");
    if (hash > percentage / 100)
      return;
  }
  return `holdout-${holdout.id}`;
}
function getFeatureFlagVariantLookupTable(variants) {
  const table = [];
  let valueMin = 0;
  for (const variant of variants) {
    const valueMax = valueMin + variant.rollout_percentage / 100;
    table.push({
      valueMin,
      valueMax,
      key: variant.key
    });
    valueMin = valueMax;
  }
  return table;
}
async function getFeatureFlagVariant(key, bucketingValue, variants) {
  const hashValue = await getFeatureFlagHash(key, bucketingValue, "variant");
  return getFeatureFlagVariantLookupTable(variants).find((variant) => hashValue >= variant.valueMin && hashValue < variant.valueMax)?.key;
}
function resolveFeatureFlagPayload(payloads, flagValue) {
  if (flagValue === false || flagValue == null || !payloads)
    return null;
  const payloadKey = typeof flagValue == "boolean" ? flagValue.toString() : flagValue;
  const payload = payloads[payloadKey] || null;
  return payload == null ? null : parsePayload(payload);
}
var NULL_VALUES_ALLOWED_OPERATORS, LONG_SCALE = 1152921504606847000, InconclusiveMatchError, LITERAL_ESCAPED_PUNCTUATION;
var init_featureFlagLocalEvaluation = __esm(() => {
  init_featureFlagUtils();
  NULL_VALUES_ALLOWED_OPERATORS = [
    "exact",
    "is_not",
    "icontains",
    "not_icontains",
    "starts_with",
    "not_starts_with",
    "ends_with",
    "not_ends_with",
    "regex",
    "not_regex"
  ];
  InconclusiveMatchError = class InconclusiveMatchError extends Error {
    constructor(message, reason = "unsupported_definition") {
      super(message);
      this.name = this.constructor.name;
      this.reason = reason;
      Object.setPrototypeOf(this, InconclusiveMatchError.prototype);
    }
  };
  LITERAL_ESCAPED_PUNCTUATION = /[\x20-\x2f:;=?@\x5b-\x60\x7b-\x7e]/;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/otlp-any-value.mjs
function newState() {
  return {
    ancestors: new WeakSet,
    remainingNodes: MAX_JSON_SAFE_VALUE_NODES
  };
}
function toOtlpKeyValueList(attrs, logger) {
  try {
    return encodeKeyValueList(attrs, logger, newState(), 0);
  } catch {
    return [];
  }
}
function encodeBigInt(value, logger) {
  const decimal = value.toString();
  const limit = BigInt(INT64_RANGE_LIMIT_DECIMAL);
  if (value >= limit || value < -limit) {
    logger?.debug(`Attribute ${decimal} is outside the int64 range; encoding it as a string`);
    return {
      stringValue: decimal
    };
  }
  return {
    intValue: decimal
  };
}
function encodeAnyValue(value, logger, state, depth) {
  if (state.remainingNodes <= 0)
    return {
      stringValue: TRUNCATED_VALUE
    };
  state.remainingNodes--;
  if (isBoolean(value))
    return {
      boolValue: value
    };
  if (typeof value == "bigint")
    return encodeBigInt(value, logger);
  if (typeof value == "number") {
    if (!Number.isFinite(value))
      return {
        stringValue: String(value)
      };
    if (Number.isInteger(value)) {
      if (Number.isSafeInteger(value))
        return {
          intValue: String(value)
        };
      if ("u" < typeof BigInt)
        return {
          stringValue: String(value)
        };
      const decimal = BigInt(value).toString();
      if (value >= INT64_RANGE_LIMIT || value < -INT64_RANGE_LIMIT) {
        logger?.debug(`Attribute ${decimal} is outside the int64 range; encoding it as a string`);
        return {
          stringValue: decimal
        };
      }
      return {
        intValue: decimal
      };
    }
    return {
      doubleValue: value
    };
  }
  if (typeof value == "string")
    return {
      stringValue: sanitizeString(value)
    };
  if (typeof value == "function")
    return {
      stringValue: FUNCTION_VALUE
    };
  if (typeof value == "symbol")
    return {
      stringValue: String(value)
    };
  if (typeof value == "object" && value !== null) {
    if (state.ancestors.has(value))
      return {
        stringValue: CIRCULAR_VALUE
      };
    if (depth >= MAX_JSON_SAFE_VALUE_DEPTH)
      return {
        stringValue: TRUNCATED_VALUE
      };
    if (value instanceof Date) {
      const time = value.getTime();
      const iso = Number.isFinite(time) ? value.toISOString() : String(value);
      return {
        stringValue: typeof iso == "string" ? sanitizeString(iso) : String(iso)
      };
    }
    state.ancestors.add(value);
    try {
      try {
        const toJSON = value.toJSON;
        if (typeof toJSON == "function")
          return encodeAnyValue(toJSON.call(value), logger, state, depth + 1);
      } catch {}
      if (isArray(value))
        return {
          arrayValue: {
            values: encodeArrayValues(value, logger, state, depth + 1)
          }
        };
      return {
        kvlistValue: {
          values: encodeKeyValueList(value, logger, state, depth + 1)
        }
      };
    } finally {
      state.ancestors.delete(value);
    }
  }
  return {
    stringValue: sanitizeString(String(value))
  };
}
function encodeArrayValues(values, logger, state, depth) {
  const result = [];
  const itemCount = Math.min(values.length, MAX_JSON_SAFE_VALUE_ITEMS);
  let index = 0;
  for (;index < itemCount && state.remainingNodes > 0; index++)
    try {
      const element = index in values ? values[index] : undefined;
      if (isNullish(element))
        continue;
      result.push(encodeAnyValue(element, logger, state, depth));
    } catch {
      result.push({
        stringValue: UNSERIALIZABLE_VALUE
      });
    }
  if (values.length > index)
    result.push({
      stringValue: TRUNCATED_VALUE
    });
  return result;
}
function encodeKeyValueList(attrs, logger, state, depth) {
  const result = [];
  for (const key in attrs)
    if (propertyIsEnumerable.call(attrs, key)) {
      if (!key) {
        logger?.debug("Dropping an attribute with an empty key");
        continue;
      }
      if (result.length >= MAX_JSON_SAFE_VALUE_ITEMS || state.remainingNodes <= 0) {
        logger?.debug("Attributes truncated: the value exceeds the OTLP encoder budget");
        break;
      }
      try {
        const value = attrs[key];
        if (isNull(value) || isUndefined(value))
          continue;
        result.push({
          key: sanitizeString(key),
          value: encodeAnyValue(value, logger, state, depth)
        });
      } catch {
        result.push({
          key: sanitizeString(key),
          value: {
            stringValue: UNSERIALIZABLE_VALUE
          }
        });
      }
    }
  return result;
}
var INT64_RANGE_LIMIT = 9223372036854776000, INT64_RANGE_LIMIT_DECIMAL = "9223372036854775808", propertyIsEnumerable;
var init_otlp_any_value = __esm(() => {
  init_type_utils();
  init_json_utils();
  propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/otlp-resource.mjs
function buildOtlpResourceAttributes(config, sdkName, sdkVersion) {
  return {
    ...assignUserAttributes({}, config.resourceAttributes),
    "service.name": config.serviceName || "unknown_service",
    ...config.environment && {
      "deployment.environment": config.environment
    },
    ...config.serviceVersion && {
      "service.version": config.serviceVersion
    },
    "telemetry.sdk.name": sdkName,
    "telemetry.sdk.version": sdkVersion
  };
}
function toOtlpResourceKeyValueList(attributes, logger) {
  const user = assignUserAttributes({}, attributes);
  const sdk = {};
  for (const key of SDK_RESOURCE_KEYS)
    if (Object.prototype.hasOwnProperty.call(user, key)) {
      sdk[key] = user[key];
      delete user[key];
    }
  return [
    ...toOtlpKeyValueList(user, logger),
    ...toOtlpKeyValueList(sdk, logger)
  ];
}
function normalizeOsName(name) {
  if (!name)
    return;
  return Object.prototype.hasOwnProperty.call(OS_NAMES, name) ? OS_NAMES[name] : name;
}
function osResourceAttributes(name, version) {
  const osName = normalizeOsName(name);
  return {
    ...osName ? {
      "os.name": osName
    } : {},
    ...version ? {
      "os.version": version
    } : {}
  };
}
var SDK_RESOURCE_KEYS, OS_NAMES;
var init_otlp_resource = __esm(() => {
  init_json_utils();
  init_otlp_any_value();
  SDK_RESOURCE_KEYS = [
    "service.name",
    "deployment.environment",
    "service.version",
    "telemetry.sdk.name",
    "telemetry.sdk.version"
  ];
  OS_NAMES = {
    darwin: "macOS",
    win32: "Windows",
    cygwin: "Windows",
    linux: "Linux",
    android: "Android",
    freebsd: "FreeBSD",
    openbsd: "OpenBSD",
    netbsd: "NetBSD",
    sunos: "SunOS",
    aix: "AIX",
    haiku: "Haiku",
    "Mac OS X": "macOS"
  };
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/logs/logs-utils.mjs
var init_logs_utils = __esm(() => {
  init_utils();
  init_json_utils();
  init_otlp_any_value();
  init_otlp_resource();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/flush-timer.mjs
class FlushTimer {
  constructor(_onFire) {
    this._onFire = _onFire;
    this._firesAt = 0;
  }
  get pending() {
    return !!this._timer;
  }
  arm(delayMs) {
    this.clear();
    this._firesAt = Date.now() + delayMs;
    this._timer = safeSetTimeout(() => {
      this._timer = undefined;
      this._onFire();
    }, delayMs);
  }
  armNoEarlierThan(delayMs) {
    if (this._timer && Date.now() + delayMs <= this._firesAt)
      return;
    this.arm(delayMs);
  }
  clear() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }
}
var init_flush_timer = __esm(() => {
  init_utils();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/utils/backoff.mjs
function drawJitter() {
  return 1 - JITTER + Math.random() * JITTER * 2;
}
function backoffDelayMs(baseMs, failures, jitter, maxMs) {
  const exponent = Math.min(Math.max(0, failures - 1), MAX_FLUSH_BACKOFF_EXPONENT);
  const delay = baseMs * 2 ** exponent;
  const capped = maxMs === undefined ? delay : Math.min(delay, Math.max(maxMs, baseMs));
  return Math.round(capped * jitter);
}
var MAX_FLUSH_BACKOFF_EXPONENT = 6, MAX_FLUSH_BACKOFF_MS = 30000, JITTER = 0.25, NO_JITTER = 1;
var init_backoff = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/logs/index.mjs
var init_logs = __esm(() => {
  init_logs_utils();
  init_types();
  init_utils();
  init_flush_timer();
  init_retry_after();
  init_backoff();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/ids.mjs
function getRandomBytes(byteLength) {
  const bytes = new Uint8Array(byteLength);
  const cryptoLike = globalThis.crypto;
  if (cryptoLike && typeof cryptoLike.getRandomValues == "function")
    try {
      cryptoLike.getRandomValues(bytes);
      return bytes;
    } catch {}
  for (let i = 0;i < byteLength; i++)
    bytes[i] = Math.floor(256 * Math.random());
  return bytes;
}
function bytesToHex(bytes) {
  let hex = "";
  for (let i = 0;i < bytes.length; i++)
    hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
function randomHexId(byteLength) {
  const hex = bytesToHex(getRandomBytes(byteLength));
  return /[^0]/.test(hex) ? hex : hex.slice(0, -1) + "1";
}
function newTraceId() {
  return randomHexId(TRACE_ID_BYTES);
}
function newSpanId() {
  return randomHexId(SPAN_ID_BYTES);
}
function isValidHexId(value, length, invalid) {
  return typeof value == "string" && value.length === length && value !== invalid && HEX_RE.test(value);
}
function isValidTraceId(value) {
  return isValidHexId(value, TRACE_ID_HEX, INVALID_TRACE_ID);
}
function isValidSpanId(value) {
  return isValidHexId(value, SPAN_ID_HEX, INVALID_SPAN_ID);
}
var TRACE_ID_BYTES = 16, SPAN_ID_BYTES = 8, TRACE_ID_HEX, SPAN_ID_HEX, INVALID_SPAN_ID = "0000000000000000", INVALID_TRACE_ID, HEX_RE;
var init_ids = __esm(() => {
  TRACE_ID_HEX = 2 * TRACE_ID_BYTES;
  SPAN_ID_HEX = 2 * SPAN_ID_BYTES;
  INVALID_TRACE_ID = INVALID_SPAN_ID + INVALID_SPAN_ID;
  HEX_RE = /^[0-9a-f]+$/;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/traceparent.mjs
function parseTraceparent(value) {
  const fields = matchTraceparent(value);
  return fields && {
    traceId: fields.traceId,
    spanId: fields.spanId,
    flags: definedFlags(fields.flags)
  };
}
function definedFlags(flags) {
  return 1 & parseInt(flags, 16) ? TRACE_FLAGS_SAMPLED : TRACE_FLAGS_UNSAMPLED;
}
function matchTraceparent(value) {
  if (typeof value != "string")
    return;
  const match = TRACEPARENT_RE.exec(value.trim());
  if (!match)
    return;
  const [, version, traceId, spanId, flags, trailing] = match;
  if (version === "ff")
    return;
  if (version === "00" && trailing)
    return;
  if (!isValidTraceId(traceId) || !isValidSpanId(spanId))
    return;
  return {
    version,
    traceId,
    spanId,
    flags
  };
}
function normalizeTraceparent(value) {
  return matchTraceparent(value) && value.trim();
}
function traceparentHeader(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}
function formatTraceparent(traceId, spanId, flags = TRACE_FLAGS_SAMPLED) {
  return `00-${traceId}-${spanId}-${flags}`;
}
function sanitizeTracestate(value) {
  if (typeof value != "string")
    return;
  const trimmed = value.trim();
  if (!trimmed)
    return;
  if (/[^\x20-\x7e\t]/.test(trimmed))
    return;
  const members = trimmed.split(",");
  if (members.length > TRACESTATE_MAX_MEMBERS)
    return;
  for (const member of members)
    if (member.trim() && !member.includes("="))
      return;
  if (trimmed.length <= TRACESTATE_MAX_LENGTH)
    return trimmed;
  return trimToLength(members);
}
function trimToLength(members) {
  const kept = [
    ...members
  ];
  const joinedLength = () => kept.reduce((total, member) => total + member.length, 0) + kept.length - 1;
  for (let index = kept.length - 1;index >= 0 && joinedLength() > TRACESTATE_MAX_LENGTH; index--)
    if (kept[index].length > TRACESTATE_LARGE_MEMBER_LENGTH)
      kept.splice(index, 1);
  while (kept.length && joinedLength() > TRACESTATE_MAX_LENGTH)
    kept.pop();
  return kept.length ? kept.join(",") : undefined;
}
var TRACEPARENT_RE, TRACE_FLAGS_SAMPLED = "01", TRACE_FLAGS_UNSAMPLED = "00", TRACESTATE_MAX_MEMBERS = 32, TRACESTATE_MAX_LENGTH = 512, TRACESTATE_LARGE_MEMBER_LENGTH = 128;
var init_traceparent = __esm(() => {
  init_ids();
  TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-.*)?$/;
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/metrics/metrics-utils.mjs
function msToUnixNano(ms) {
  return String(ms) + "000000";
}
function seriesKey(type, name, unit, attributes) {
  let attrsKey = "";
  if (attributes) {
    const keys = Object.keys(attributes).sort();
    attrsKey = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(attributes[k])}`).join(",");
  }
  return `${type}\x00${name}\x00${unit ?? ""}\x00${attrsKey}`;
}
function bucketIndexFor(value, bounds) {
  for (let i = 0;i < bounds.length; i++)
    if (value <= bounds[i])
      return i;
  return bounds.length;
}
function buildMetricsResourceAttributes(config, scopeName, scopeVersion) {
  return buildOtlpResourceAttributes(config, scopeName, scopeVersion);
}
function buildOtlpMetricsPayload(metrics, resourceAttributes, scopeName, scopeVersion) {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: toOtlpResourceKeyValueList(resourceAttributes)
        },
        scopeMetrics: [
          {
            scope: {
              name: scopeName,
              version: scopeVersion
            },
            metrics
          }
        ]
      }
    ]
  };
}
var DEFAULT_HISTOGRAM_BOUNDS;
var init_metrics_utils = __esm(() => {
  init_otlp_resource();
  DEFAULT_HISTOGRAM_BOUNDS = [
    0,
    5,
    10,
    25,
    50,
    75,
    100,
    250,
    500,
    750,
    1000,
    2500,
    5000,
    7500,
    1e4
  ];
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/metrics/config.mjs
function resolveMetricsConfig(config) {
  const resourceAttributes = config?.resourceAttributes;
  return {
    serviceName: resourceAttributes?.["service.name"] ?? config?.serviceName,
    serviceVersion: resourceAttributes?.["service.version"] ?? config?.serviceVersion,
    environment: resourceAttributes?.["deployment.environment"] ?? config?.environment,
    resourceAttributes,
    beforeSend: config?.beforeSend,
    flushIntervalMs: config?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    maxSeriesPerFlush: config?.maxSeriesPerFlush ?? DEFAULT_MAX_SERIES_PER_FLUSH
  };
}
var DEFAULT_FLUSH_INTERVAL_MS = 1e4, DEFAULT_MAX_SERIES_PER_FLUSH = 1000;
var init_config = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/metrics/index.mjs
class PostHogMetrics {
  constructor(_instance, _config, _logger) {
    this._instance = _instance;
    this._config = _config;
    this._logger = _logger;
    this._series = new Map;
    this._flushTimer = new FlushTimer(() => this.flush().catch((e) => {
      this._logger.error("Metrics flush failed:", e);
    }));
    this._flushPromise = null;
    this._seriesCapWarned = false;
    this._typeByName = new Map;
    this._typeCollisionWarned = new Set;
    this._boundsByHistogram = new Map;
    this._boundsConflictWarned = new Set;
    this._boundsCapWarned = false;
    this._retryAfter = new RetryAfterWindow;
    this._consecutiveFlushFailures = 0;
    this._flushJitter = NO_JITTER;
    this._generation = 0;
  }
  count(name, value = 1, options) {
    this._capture({
      name,
      type: "count",
      value,
      unit: options?.unit,
      attributes: options?.attributes
    });
  }
  gauge(name, value, options) {
    this._capture({
      name,
      type: "gauge",
      value,
      unit: options?.unit,
      attributes: options?.attributes
    });
  }
  histogram(name, value, options) {
    this._capture({
      name,
      type: "histogram",
      value,
      unit: options?.unit,
      attributes: options?.attributes,
      bounds: isArray(options?.bounds) ? options.bounds.slice() : options?.bounds
    });
  }
  flush() {
    const prev = this._flushPromise;
    const run = async () => {
      if (prev)
        await prev.catch(() => {});
      await this._doFlush();
    };
    const p = run().finally(() => {
      if (this._flushPromise === p)
        this._flushPromise = null;
    });
    this._flushPromise = p;
    return p;
  }
  drainWindow() {
    if (this._series.size === 0)
      return null;
    const window = this._series;
    this._startWindow();
    return this._buildPayload(window);
  }
  reset() {
    this._generation++;
    this._retryAfter.reset();
    this._consecutiveFlushFailures = 0;
    this._flushJitter = NO_JITTER;
    this._flushTimer.clear();
    this._flushPromise = null;
    this._startWindow();
    this._boundsByHistogram = new Map;
    this._boundsCapWarned = false;
  }
  _startWindow() {
    this._series = new Map;
    this._seriesCapWarned = false;
    this._typeByName = new Map;
    this._typeCollisionWarned = new Set;
    this._boundsConflictWarned = new Set;
  }
  _capture(sample) {
    if (this._instance.isDisabled || this._instance.optedOut)
      return;
    const filtered = this._runBeforeSend(sample);
    if (filtered === null)
      return;
    if (!filtered.name || typeof filtered.name != "string")
      return void this._logger.warn("Dropping metric with empty name");
    if (typeof filtered.value != "number" || !Number.isFinite(filtered.value))
      return void this._logger.warn(`Dropping metric '${filtered.name}': value must be a finite number`);
    if (filtered.type !== "count" && filtered.type !== "gauge" && filtered.type !== "histogram")
      return void this._logger.warn(`Dropping metric '${filtered.name}': unknown type '${String(filtered.type)}'`);
    if (filtered.type === "count" && filtered.value < 0)
      return void this._logger.warn(`Dropping count '${filtered.name}': counters are monotonic, value must be >= 0`);
    let attributes;
    let key;
    try {
      attributes = filtered.attributes ? {
        ...filtered.attributes
      } : undefined;
      key = seriesKey(filtered.type, filtered.name, filtered.unit, attributes);
    } catch (e) {
      this._logger.warn(`Dropping metric '${filtered.name}': attributes could not be serialized`, e);
      return;
    }
    let state = this._series.get(key);
    if (!state && !this._admitNewSeries())
      return;
    let bounds;
    if (filtered.type === "histogram") {
      bounds = this._histogramBounds(filtered.name, filtered.unit, filtered.bounds);
      if (!bounds)
        return;
    }
    if (!state) {
      state = {
        name: filtered.name,
        type: filtered.type,
        unit: filtered.unit,
        attributes,
        windowStartMs: Date.now(),
        hist: bounds && emptyHistogram(bounds)
      };
      this._series.set(key, state);
    }
    const seenType = this._typeByName.get(filtered.name);
    if (seenType === undefined)
      this._typeByName.set(filtered.name, filtered.type);
    else if (seenType !== filtered.type && !this._typeCollisionWarned.has(filtered.name)) {
      this._typeCollisionWarned.add(filtered.name);
      this._logger.warn(`Metric name '${filtered.name}' is already used as a ${seenType}; recording it as a ${filtered.type} too will blend both series in charts. Use a distinct name.`);
    }
    this._fold(state, filtered.value);
    const traceContext = this._activeTraceContext();
    if (traceContext)
      state.exemplar = {
        ...traceContext,
        value: filtered.value,
        timeMs: Date.now()
      };
    this._armFlushTimer();
  }
  _activeTraceContext() {
    try {
      const parsed = parseTraceparent(this._instance.getActiveSpan?.()?.traceparent());
      if (parsed && parsed.flags === TRACE_FLAGS_SAMPLED)
        return {
          traceId: parsed.traceId,
          spanId: parsed.spanId
        };
    } catch {}
  }
  _admitNewSeries() {
    if (this._series.size < this._config.maxSeriesPerFlush)
      return true;
    if (!this._seriesCapWarned) {
      this._seriesCapWarned = true;
      this._logger.warn(`Metric series cap reached (${this._config.maxSeriesPerFlush} per flush window); dropping new series until the next flush. Reduce attribute cardinality.`);
    }
    return false;
  }
  _histogramBounds(name, unit, requested) {
    if (requested !== undefined && !isValidBounds(requested))
      return void this._logger.warn(`Dropping histogram '${name}': bounds must be a non-empty array of finite, strictly increasing numbers`);
    const histogramKey = seriesKey("histogram", name, unit, undefined);
    const fixed = this._boundsByHistogram.get(histogramKey);
    if (fixed) {
      this._warnOnBoundsConflict(name, histogramKey, fixed, requested);
      return fixed;
    }
    if (this._boundsByHistogram.size >= this._config.maxSeriesPerFlush) {
      if (!this._boundsCapWarned) {
        this._boundsCapWarned = true;
        this._logger.warn(`Histogram bounds limit reached (${this._config.maxSeriesPerFlush} distinct histograms); new histograms that pass custom bounds are dropped. Reduce histogram name cardinality.`);
      }
      if (requested && !sameBounds(requested, DEFAULT_HISTOGRAM_BOUNDS))
        return;
      return DEFAULT_HISTOGRAM_BOUNDS;
    }
    const bounds = requested ? requested.slice() : DEFAULT_HISTOGRAM_BOUNDS;
    this._boundsByHistogram.set(histogramKey, bounds);
    return bounds;
  }
  _warnOnBoundsConflict(name, histogramKey, fixed, requested) {
    if (sameBounds(fixed, requested ?? DEFAULT_HISTOGRAM_BOUNDS) || this._boundsConflictWarned.has(histogramKey))
      return;
    this._boundsConflictWarned.add(histogramKey);
    this._logger.warn(`Histogram '${name}' already uses the bounds [${fixed.join(", ")}]; samples that pass different bounds are recorded in those buckets.`);
  }
  _fold(state, value) {
    switch (state.type) {
      case "count":
        state.total = (state.total ?? 0) + value;
        break;
      case "gauge":
        state.last = value;
        break;
      case "histogram": {
        const hist = state.hist;
        hist.count += 1;
        hist.sum += value;
        hist.min = Math.min(hist.min, value);
        hist.max = Math.max(hist.max, value);
        hist.bucketCounts[bucketIndexFor(value, hist.bounds)] += 1;
        break;
      }
    }
  }
  _runBeforeSend(sample) {
    const beforeSend = this._config.beforeSend;
    if (!beforeSend)
      return sample;
    const fns = isArray(beforeSend) ? beforeSend : [
      beforeSend
    ];
    let result = sample;
    for (const fn of fns)
      try {
        const next = fn(result);
        if (!next) {
          this._logger.info("Metric was rejected in beforeSend function");
          return null;
        }
        result = next;
      } catch (e) {
        this._logger.error("Error in beforeSend function for metric:", e);
        return null;
      }
    return result;
  }
  _armFlushTimer() {
    if (this._flushTimer.pending)
      return;
    this._flushTimer.arm(this._nextFlushDelay());
  }
  _nextFlushDelay() {
    return Math.max(backoffDelayMs(this._config.flushIntervalMs, this._consecutiveFlushFailures, this._flushJitter, MAX_FLUSH_BACKOFF_MS), this._retryAfter.remainingMs());
  }
  async _doFlush() {
    this._flushTimer.clear();
    if (this._series.size === 0)
      return;
    const window = this._series;
    this._startWindow();
    const generation = this._generation;
    const outcome = await this._instance._sendMetricsBatch(this._buildPayload(window));
    if (generation !== this._generation)
      return;
    this._retryAfter.record(outcome);
    if (outcome.kind === "retry-later") {
      this._consecutiveFlushFailures++;
      this._flushJitter = drawJitter();
    } else {
      this._consecutiveFlushFailures = 0;
      this._flushJitter = NO_JITTER;
    }
    if (this._flushTimer.pending)
      this._flushTimer.arm(this._nextFlushDelay());
    switch (outcome.kind) {
      case "ok":
        return;
      case "retry-later":
        this._mergeWindowBack(window);
        this._flushTimer.armNoEarlierThan(this._nextFlushDelay());
        return;
      case "too-large":
        this._logger.warn("Metrics batch exceeded the server size limit and was dropped");
        return;
      case "fatal":
        this._logger.error("Failed to send metrics batch:", outcome.error);
        return;
    }
  }
  _buildPayload(window) {
    return buildOtlpMetricsPayload(this._buildMetrics(window), buildMetricsResourceAttributes(this._config, this._instance.getLibraryId(), this._instance.getLibraryVersion()), this._instance.getLibraryId(), this._instance.getLibraryVersion());
  }
  _buildMetrics(window) {
    const nowNano = msToUnixNano(Date.now());
    const byMetric = new Map;
    for (const state of window.values()) {
      const metricKey = seriesKey(state.type, state.name, state.unit, undefined);
      let metric = byMetric.get(metricKey);
      if (!metric) {
        metric = {
          name: state.name,
          ...state.unit && {
            unit: state.unit
          }
        };
        if (state.type === "count")
          metric.sum = {
            aggregationTemporality: OTLP_TEMPORALITY_DELTA,
            isMonotonic: true,
            dataPoints: []
          };
        else if (state.type === "gauge")
          metric.gauge = {
            dataPoints: []
          };
        else
          metric.histogram = {
            aggregationTemporality: OTLP_TEMPORALITY_DELTA,
            dataPoints: []
          };
        byMetric.set(metricKey, metric);
      }
      const attributes = toOtlpKeyValueList(state.attributes ?? {}, this._logger);
      const startNano = msToUnixNano(state.windowStartMs);
      const exemplars = toOtlpExemplars(state.exemplar);
      if (state.type === "count") {
        const dp = {
          attributes,
          startTimeUnixNano: startNano,
          timeUnixNano: nowNano,
          asDouble: state.total ?? 0,
          ...exemplars
        };
        metric.sum.dataPoints.push(dp);
      } else if (state.type === "gauge") {
        const dp = {
          attributes,
          timeUnixNano: nowNano,
          asDouble: state.last ?? 0,
          ...exemplars
        };
        metric.gauge.dataPoints.push(dp);
      } else {
        const hist = state.hist;
        const dp = {
          attributes,
          startTimeUnixNano: startNano,
          timeUnixNano: nowNano,
          count: hist.count,
          sum: hist.sum,
          min: hist.min,
          max: hist.max,
          bucketCounts: hist.bucketCounts,
          explicitBounds: hist.bounds,
          ...exemplars
        };
        metric.histogram.dataPoints.push(dp);
      }
    }
    return Array.from(byMetric.values());
  }
  _mergeWindowBack(window) {
    for (const [key, old] of window) {
      const current = this._series.get(key);
      if (!current) {
        if (this._admitNewSeries())
          this._series.set(key, old);
        continue;
      }
      current.windowStartMs = Math.min(current.windowStartMs, old.windowStartMs);
      current.exemplar = current.exemplar ?? old.exemplar;
      switch (current.type) {
        case "count":
          current.total = (current.total ?? 0) + (old.total ?? 0);
          break;
        case "gauge":
          break;
        case "histogram": {
          const hist = current.hist;
          const oldHist = old.hist;
          hist.count += oldHist.count;
          hist.sum += oldHist.sum;
          hist.min = Math.min(hist.min, oldHist.min);
          hist.max = Math.max(hist.max, oldHist.max);
          for (let i = 0;i < hist.bucketCounts.length; i++)
            hist.bucketCounts[i] += oldHist.bucketCounts[i];
          break;
        }
      }
    }
  }
}
function isValidBounds(bounds) {
  if (!isArray(bounds) || bounds.length === 0)
    return false;
  for (let i = 0;i < bounds.length; i++)
    if (!Number.isFinite(bounds[i]) || i > 0 && bounds[i] <= bounds[i - 1])
      return false;
  return true;
}
function sameBounds(a, b) {
  if (a === b)
    return true;
  if (a.length !== b.length)
    return false;
  for (let i = 0;i < a.length; i++)
    if (a[i] !== b[i])
      return false;
  return true;
}
function emptyHistogram(bounds) {
  return {
    bounds,
    count: 0,
    sum: 0,
    min: 1 / 0,
    max: -1 / 0,
    bucketCounts: new Array(bounds.length + 1).fill(0)
  };
}
function toOtlpExemplars(exemplar) {
  if (!exemplar)
    return {};
  return {
    exemplars: [
      {
        filteredAttributes: [],
        timeUnixNano: msToUnixNano(exemplar.timeMs),
        asDouble: exemplar.value,
        traceId: exemplar.traceId,
        spanId: exemplar.spanId
      }
    ]
  };
}
var OTLP_TEMPORALITY_DELTA = 1;
var init_metrics = __esm(() => {
  init_utils();
  init_flush_timer();
  init_retry_after();
  init_backoff();
  init_otlp_any_value();
  init_traceparent();
  init_metrics_utils();
  init_config();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/sanitize.mjs
function sanitizeName(name, label, maxLength, logger) {
  if (typeof name == "string" && name.trim())
    return name.length > maxLength ? name.slice(0, maxLength) : name;
  logger?.debug(`${label} must be a non-empty string; using "${FALLBACK_SPAN_NAME}"`);
  return FALLBACK_SPAN_NAME;
}
function toEpochMs(value) {
  if (value == null)
    return;
  let ms = value;
  if (value instanceof Date)
    try {
      ms = value.getTime();
    } catch {
      return;
    }
  if (typeof ms != "number" || !Number.isFinite(ms))
    return;
  if (ms < MIN_TIMESTAMP_MS || ms > MAX_TIMESTAMP_MS)
    return;
  return ms;
}
function resolveStartTime(value, now, logger) {
  const supplied = toEpochMs(value);
  if (supplied === undefined) {
    if (value !== undefined)
      logger?.debug("Span startTime is out of range or not a valid time; using the current time");
    return now;
  }
  if (now - supplied > DEEP_BACKDATE_WARNING_MS)
    logger?.debug("Span startTime is more than 24 hours in the past; the server will clamp it to receive time and keep the original in $originalTimestamp");
  else if (supplied > now)
    logger?.debug("Span startTime is in the future; the span may export with a zero duration");
  return supplied;
}
function clampEndTime(endTime, startTime) {
  return endTime < startTime ? startTime : endTime;
}
function resolveSuppliedTime(value, derived, label, logger) {
  const supplied = toEpochMs(value);
  if (supplied === undefined) {
    if (value !== undefined)
      logger?.debug(`Span ${label} is out of range or not a valid time; using the derived time`);
    return derived;
  }
  return supplied;
}
var FALLBACK_SPAN_NAME = "unknown", MAX_TIMESTAMP_MS = 9223372036854, MIN_TIMESTAMP_MS = 0, DEEP_BACKDATE_WARNING_MS = 86400000;
var init_sanitize = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/span.mjs
function monotonicNow() {
  const perf = globalThis.performance;
  return typeof perf?.now == "function" ? perf.now() : undefined;
}

class PostHogSpan {
  constructor(init, _onEnd, _logger) {
    this._onEnd = _onEnd;
    this._logger = _logger;
    this._events = [];
    this._ended = false;
    this._userAttributeCount = 0;
    this._userEventCount = 0;
    this._droppedAttributes = 0;
    this._droppedEvents = 0;
    this._traceId = init.traceId;
    this._spanId = init.spanId;
    this._parentSpanId = init.parentSpanId;
    this._traceState = init.traceState;
    this._traceFlags = init.traceFlags ?? TRACE_FLAGS_SAMPLED;
    this._parentIsRemote = init.parentIsRemote ?? false;
    this._name = init.name;
    this._kind = init.kind;
    this._autoKeys = new Set(init.autoAttributeKeys);
    this._maxAttributes = init.maxAttributes;
    this._maxEvents = init.maxEvents;
    this._maxAttributesPerEvent = init.maxAttributesPerEvent;
    this._maxAttributeValueLength = init.maxAttributeValueLength;
    this._attributes = Object.create(null);
    for (const key of Object.keys(init.attributes))
      this._writeAttribute(key, init.attributes[key]);
    this._startMono = init.backdated ? undefined : monotonicNow();
    this._startTime = init.clockAnchor && this._startMono !== undefined ? init.clockAnchor.wall + (this._startMono - init.clockAnchor.mono) : init.startTime;
    if (this._startMono !== undefined)
      this._clockAnchor = init.clockAnchor ?? {
        wall: this._startTime,
        mono: this._startMono
      };
  }
  _now() {
    if (this._startMono !== undefined) {
      const mono = monotonicNow();
      if (mono !== undefined)
        return this._startTime + Math.max(0, mono - this._startMono);
    }
    return Date.now();
  }
  _mutable(operation) {
    if (this._ended) {
      this._logger?.debug(`Ignoring ${operation} on a span that has already ended`);
      return false;
    }
    return true;
  }
  _writeAttribute(key, value) {
    if (isNullish(value)) {
      if (key in this._attributes && !this._autoKeys.has(key))
        this._userAttributeCount--;
      delete this._attributes[key];
      return;
    }
    if (!this._autoKeys.has(key) && !(key in this._attributes)) {
      if (this._userAttributeCount >= this._maxAttributes)
        return void this._droppedAttributes++;
      this._userAttributeCount++;
    }
    this._attributes[key] = truncateAttributeValue(value, this._maxAttributeValueLength);
  }
  setAttribute(key, value) {
    if (this._mutable("setAttribute"))
      this._writeAttribute(key, value);
    return this;
  }
  setAttributes(attributes) {
    if (this._mutable("setAttributes")) {
      const safe = assignUserAttributes({}, attributes);
      for (const key of Object.keys(safe))
        this._writeAttribute(key, safe[key]);
    }
    return this;
  }
  addEvent(name, attributes, timestamp) {
    if (this._mutable("addEvent")) {
      if (this._userEventCount >= this._maxEvents) {
        this._droppedEvents++;
        return this;
      }
      this._userEventCount++;
      const bounded = attributes && boundAttributes(attributes, this._maxAttributesPerEvent, this._maxAttributeValueLength);
      this._events.push({
        name: sanitizeName(name, "Span event name", this._maxAttributeValueLength, this._logger),
        timestamp: resolveSuppliedTime(timestamp, this._now(), "event timestamp", this._logger),
        ...bounded && {
          attributes: bounded.attributes,
          ...bounded.dropped && {
            droppedAttributesCount: bounded.dropped
          }
        }
      });
    }
    return this;
  }
  setStatus(status, message) {
    if (this._mutable("setStatus")) {
      if (status !== "ok" && status !== "error") {
        this._logger?.debug(`Ignoring unknown span status "${String(status)}"; expected "ok" or "error"`);
        return this;
      }
      this._status = {
        code: status,
        ...message && {
          message: truncateString(message, this._maxAttributeValueLength)
        }
      };
    }
    return this;
  }
  get statusIsExplicitlyOk() {
    return this._status?.code === "ok";
  }
  recordException(error) {
    if (!this._mutable("recordException"))
      return this;
    const { type, message, stack } = describeError2(error);
    this.addEvent(EXCEPTION_EVENT_NAME, {
      "exception.type": type,
      "exception.message": message,
      ...stack && {
        "exception.stacktrace": stack
      }
    });
    return this.setStatus("error", message);
  }
  updateName(name) {
    if (this._mutable("updateName"))
      this._name = sanitizeName(name, "Span name", this._maxAttributeValueLength, this._logger);
    return this;
  }
  traceparent() {
    return formatTraceparent(this._traceId, this._spanId, this._traceFlags);
  }
  tracestate() {
    return this._traceState ?? null;
  }
  childContext() {
    return {
      traceId: this._traceId,
      parentSpanId: this._spanId,
      traceState: this._traceState,
      traceFlags: this._traceFlags,
      clockAnchor: this._clockAnchor
    };
  }
  end(endTime) {
    if (this._ended)
      return void this._logger?.debug("Ignoring end() on a span that has already ended");
    this._ended = true;
    const derived = this._now();
    const resolved = resolveSuppliedTime(endTime, derived, "end time", this._logger);
    this._onEnd({
      traceId: this._traceId,
      spanId: this._spanId,
      ...this._parentSpanId && {
        parentSpanId: this._parentSpanId
      },
      ...this._traceState && {
        traceState: this._traceState
      },
      traceFlags: this._traceFlags,
      parentIsRemote: this._parentIsRemote,
      name: this._name,
      kind: this._kind,
      ...this._status && {
        status: this._status
      },
      attributes: {
        ...this._attributes
      },
      events: this._events,
      startTime: this._startTime,
      endTime: clampEndTime(resolved, this._startTime),
      ...this._droppedAttributes && {
        droppedAttributesCount: this._droppedAttributes
      },
      ...this._droppedEvents && {
        droppedEventsCount: this._droppedEvents
      }
    }, this._autoKeys);
  }
}
function safeString(value) {
  try {
    return typeof value == "string" ? value : String(value);
  } catch {
    return UNSERIALIZABLE_VALUE;
  }
}
function nonNegativeCount(value) {
  if (typeof value != "number" || !Number.isFinite(value) || value <= 0)
    return 0;
  return Math.min(Math.floor(value), MAX_UINT32);
}
function orderedKeys(attributes, keysBeforeHook) {
  if (!keysBeforeHook.length)
    return Object.keys(attributes);
  const beforeHook = keysBeforeHook.filter((key) => Object.prototype.propertyIsEnumerable.call(attributes, key));
  const seen = new Set(beforeHook);
  return [
    ...beforeHook,
    ...Object.keys(attributes).filter((key) => !seen.has(key))
  ];
}
function applySpanLimits(record, autoKeys, maxAttributes, maxEvents, maxAttributesPerEvent, maxAttributeValueLength, keysBeforeHook = []) {
  let kept = 0;
  let droppedAttributes = 0;
  const attributes = {};
  for (const key of orderedKeys(record.attributes, keysBeforeHook)) {
    const value = record.attributes[key];
    if (!isNullish(value)) {
      if (!autoKeys.has(key)) {
        if (kept >= maxAttributes) {
          droppedAttributes++;
          continue;
        }
        kept++;
      }
      Object.defineProperty(attributes, key, {
        value: truncateAttributeValue(value, maxAttributeValueLength),
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
  }
  record.attributes = attributes;
  if (droppedAttributes)
    record.droppedAttributesCount = nonNegativeCount(record.droppedAttributesCount) + droppedAttributes;
  let keptEvents = 0;
  let droppedEvents = 0;
  const events = [];
  for (const event of record.events) {
    if (keptEvents >= maxEvents) {
      droppedEvents++;
      continue;
    }
    keptEvents++;
    if (event.attributes) {
      const bounded = boundAttributes(event.attributes, maxAttributesPerEvent, maxAttributeValueLength);
      event.attributes = bounded.attributes;
      if (bounded.dropped)
        event.droppedAttributesCount = nonNegativeCount(event.droppedAttributesCount) + bounded.dropped;
    }
    events.push(event);
  }
  record.events = events;
  if (droppedEvents)
    record.droppedEventsCount = nonNegativeCount(record.droppedEventsCount) + droppedEvents;
  if (record.status?.message)
    record.status = {
      ...record.status,
      message: truncateString(safeString(record.status.message), maxAttributeValueLength)
    };
}

class NoopSpan {
  setAttribute() {
    return this;
  }
  setAttributes() {
    return this;
  }
  addEvent() {
    return this;
  }
  setStatus() {
    return this;
  }
  recordException() {
    return this;
  }
  updateName() {
    return this;
  }
  traceparent() {
    return null;
  }
  tracestate() {
    return null;
  }
  end() {}
}
function readStack(error) {
  try {
    const stack = error.stack;
    return typeof stack == "string" && stack ? {
      stack
    } : {};
  } catch {
    return {};
  }
}
function inertSpan(options, active) {
  const parent = traceparentHeader(options?.parent) ?? active;
  const inbound = typeof parent == "string" || parent == null ? parent : readHandle(parent, "traceparent");
  const traceparent = normalizeTraceparent(inbound);
  if (!traceparent)
    return NOOP_SPAN;
  const tracestate = typeof parent == "string" || parent == null ? options?.tracestate : readHandle(parent, "tracestate");
  return new PassThroughSpan(traceparent, sanitizeTracestate(tracestate));
}
function readHandle(parent, method) {
  try {
    const fn = parent[method];
    return typeof fn == "function" ? fn.call(parent) : undefined;
  } catch {
    return;
  }
}
function truncateString(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
function truncateAttributeValue(value, maxLength) {
  return truncateValue(value, maxLength, {
    ancestors: new WeakSet,
    remainingNodes: MAX_JSON_SAFE_VALUE_NODES
  }, 0);
}
function truncateValue(value, maxLength, state, depth) {
  if (value === null || typeof value != "object") {
    if (isNullish(value))
      return value;
    if (state.remainingNodes <= 0)
      return value;
    state.remainingNodes--;
    return typeof value == "string" ? truncateString(value, maxLength) : value;
  }
  if (state.ancestors.has(value))
    return CIRCULAR_VALUE;
  if (state.remainingNodes <= 0 || depth >= MAX_JSON_SAFE_VALUE_DEPTH)
    return value;
  state.remainingNodes--;
  state.ancestors.add(value);
  try {
    if (value instanceof Date)
      return value;
    const resolved = resolveToJson(value);
    if (resolved.selfDescribed)
      return isNullish(resolved.value) ? String(resolved.value) : truncateValue(resolved.value, maxLength, state, depth + 1);
    if (isArray(value)) {
      const walked = Math.min(value.length, MAX_JSON_SAFE_VALUE_ITEMS);
      const boundedItems = [];
      for (let index = 0;index < walked; index++)
        try {
          boundedItems.push(truncateValue(value[index], maxLength, state, depth + 1));
        } catch {
          boundedItems.push(UNSERIALIZABLE_VALUE);
        }
      if (value.length > walked)
        boundedItems.length = value.length;
      return boundedItems;
    }
    const bounded = {};
    let emittable = 0;
    for (const key of Object.keys(value)) {
      if (emittable >= MAX_JSON_SAFE_VALUE_ITEMS)
        break;
      let boundedItem;
      try {
        boundedItem = truncateValue(value[key], maxLength, state, depth + 1);
      } catch {
        boundedItem = UNSERIALIZABLE_VALUE;
      }
      if (key && !isNullish(boundedItem))
        emittable++;
      Object.defineProperty(bounded, key, {
        value: boundedItem,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
    return bounded;
  } catch {
    return value;
  } finally {
    state.ancestors.delete(value);
  }
}
function resolveToJson(value) {
  try {
    const toJSON = value.toJSON;
    if (typeof toJSON == "function")
      return {
        selfDescribed: true,
        value: toJSON.call(value)
      };
  } catch {}
  return {
    selfDescribed: false
  };
}
function boundAttributes(source, max, maxLength) {
  let keys;
  try {
    keys = Object.keys(source);
  } catch {
    return {
      attributes: {},
      dropped: 0
    };
  }
  const attributes = {};
  let kept = 0;
  let dropped = 0;
  for (const key of keys) {
    if (kept >= max) {
      dropped++;
      continue;
    }
    let value;
    try {
      value = truncateAttributeValue(source[key], maxLength);
    } catch {
      value = UNSERIALIZABLE_VALUE;
    }
    if (!isNullish(value)) {
      kept++;
      Object.defineProperty(attributes, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
  }
  return {
    attributes,
    dropped
  };
}
function truncateAttributes(attributes, maxLength) {
  for (const key of Object.keys(attributes))
    attributes[key] = truncateAttributeValue(attributes[key], maxLength);
  return attributes;
}
function runWithActiveSpan(contextManager, span, fn) {
  return span === NOOP_SPAN ? fn(span) : contextManager.with(span, () => fn(span));
}
function describeError2(error) {
  try {
    const stack = readStack(error);
    if (isError(error))
      return {
        type: error.name || "Error",
        message: error.message || "",
        ...stack
      };
    if (typeof error == "string")
      return {
        type: "string",
        message: error
      };
    if (error && typeof error == "object") {
      const maybe = error;
      if (typeof maybe.message == "string")
        return {
          type: typeof maybe.name == "string" ? maybe.name : "Object",
          message: maybe.message,
          ...stack
        };
    }
    return {
      type: typeof error,
      message: String(error)
    };
  } catch {
    return {
      type: typeof error,
      message: ""
    };
  }
}
var EXCEPTION_EVENT_NAME = "exception", MAX_UINT32 = 4294967295, NOOP_SPAN, PassThroughSpan;
var init_span = __esm(() => {
  init_traceparent();
  init_sanitize();
  init_utils();
  init_json_utils();
  NOOP_SPAN = /* @__PURE__ */ new NoopSpan;
  PassThroughSpan = class PassThroughSpan extends NoopSpan {
    constructor(_traceparent, _tracestate) {
      super(), this._traceparent = _traceparent, this._tracestate = _tracestate;
    }
    traceparent() {
      return this._traceparent;
    }
    tracestate() {
      return this._tracestate ?? null;
    }
  };
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/otlp.mjs
function spanFlags(record) {
  const traceFlags = parseInt(record.traceFlags, 16);
  const w3c = Number.isFinite(traceFlags) ? 255 & traceFlags : TRACE_FLAGS_SAMPLED2;
  return w3c | SPAN_FLAGS_CONTEXT_HAS_IS_REMOTE | (record.parentIsRemote ? SPAN_FLAGS_CONTEXT_IS_REMOTE : 0);
}
function wireString(value) {
  if (typeof value == "string")
    return sanitizeString(value);
  try {
    return sanitizeString(String(value));
  } catch {
    return UNSERIALIZABLE_VALUE;
  }
}
function spanKindToOtlp(kind) {
  if (kind && Object.prototype.hasOwnProperty.call(SPAN_KIND_TO_OTLP, kind))
    return SPAN_KIND_TO_OTLP[kind];
  return SPAN_KIND_TO_OTLP.internal;
}
function msToUnixNanoString(ms) {
  let whole = Math.floor(ms);
  let fractionalNanos = Math.round((ms - whole) * 1e6);
  if (fractionalNanos >= 1e6) {
    whole += 1;
    fractionalNanos = 0;
  }
  return String(whole) + String(fractionalNanos).padStart(6, "0");
}
function toOtlpEvent(event, logger) {
  const encoded = {
    name: wireString(event.name),
    timeUnixNano: msToUnixNanoString(event.timestamp)
  };
  if (event.attributes) {
    const attributes = toOtlpKeyValueList(event.attributes, logger);
    if (attributes.length)
      encoded.attributes = attributes;
  }
  const dropped = nonNegativeCount(event.droppedAttributesCount);
  if (dropped)
    encoded.droppedAttributesCount = dropped;
  return encoded;
}
function buildOtlpSpan(record, logger) {
  const span = {
    traceId: record.traceId,
    spanId: record.spanId,
    name: wireString(record.name),
    kind: spanKindToOtlp(record.kind),
    startTimeUnixNano: msToUnixNanoString(record.startTime),
    endTimeUnixNano: msToUnixNanoString(record.endTime),
    flags: spanFlags(record)
  };
  if (record.parentSpanId)
    span.parentSpanId = record.parentSpanId;
  if (record.traceState)
    span.traceState = wireString(record.traceState);
  const attributes = toOtlpKeyValueList(record.attributes, logger);
  if (attributes.length)
    span.attributes = attributes;
  if (record.events.length)
    span.events = record.events.map((event) => toOtlpEvent(event, logger));
  const droppedAttributes = nonNegativeCount(record.droppedAttributesCount);
  if (droppedAttributes)
    span.droppedAttributesCount = droppedAttributes;
  const droppedEvents = nonNegativeCount(record.droppedEventsCount);
  if (droppedEvents)
    span.droppedEventsCount = droppedEvents;
  if (record.status)
    span.status = {
      code: SPAN_STATUS_TO_OTLP[record.status.code],
      ...record.status.message && {
        message: wireString(record.status.message)
      }
    };
  return span;
}
function buildTracesResourceAttributes(config, sdkName, sdkVersion) {
  return buildOtlpResourceAttributes(config, sdkName, sdkVersion);
}
function buildOtlpTracesPayload(spans, resourceAttributes, scopeName, scopeVersion, logger) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: toOtlpResourceKeyValueList(resourceAttributes, logger)
        },
        scopeSpans: [
          {
            scope: {
              name: scopeName,
              version: scopeVersion
            },
            spans
          }
        ]
      }
    ]
  };
}
var SPAN_KIND_TO_OTLP, SPAN_STATUS_TO_OTLP, TRACE_FLAGS_SAMPLED2 = 1, SPAN_FLAGS_CONTEXT_HAS_IS_REMOTE = 256, SPAN_FLAGS_CONTEXT_IS_REMOTE = 512;
var init_otlp = __esm(() => {
  init_span();
  init_otlp_any_value();
  init_json_utils();
  init_otlp_resource();
  SPAN_KIND_TO_OTLP = {
    internal: 1,
    server: 2,
    client: 3,
    producer: 4,
    consumer: 5
  };
  SPAN_STATUS_TO_OTLP = {
    ok: 1,
    error: 2
  };
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/index.mjs
function clockNow() {
  return monotonicNow() ?? Date.now();
}
function isOwnSpan(value) {
  try {
    return value instanceof PostHogSpan;
  } catch {
    return false;
  }
}
function remoteContext(header, tracestate) {
  const remote = parseTraceparent(header);
  if (!remote)
    return;
  return {
    traceId: remote.traceId,
    parentSpanId: remote.spanId,
    traceState: sanitizeTracestate(tracestate),
    traceFlags: remote.flags,
    isRemote: true
  };
}
function looksLikeSpan(value) {
  try {
    return typeof value.traceparent == "function";
  } catch {
    return false;
  }
}
function isSpanRecordShape(record) {
  return !!record.attributes && typeof record.attributes == "object" && !Array.isArray(record.attributes) && Array.isArray(record.events) && record.name !== undefined && record.kind !== undefined && record.startTime !== undefined && record.endTime !== undefined;
}
function restoreField(record, field, value) {
  if (record[field] !== value)
    record[field] = value;
}
function withRestoredIdentity(hooked, original) {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(hooked);
    for (const field of [
      "traceId",
      "spanId",
      "parentSpanId",
      "traceState"
    ])
      descriptors[field] = {
        value: original[field],
        enumerable: true,
        writable: true,
        configurable: true
      };
    return Object.create(Object.getPrototypeOf(hooked), descriptors);
  } catch {
    return hooked;
  }
}

class PostHogTraces {
  constructor(_instance, _config, _logger, _getContext, _contextManager, _onSpanQueued) {
    this._instance = _instance;
    this._config = _config;
    this._logger = _logger;
    this._getContext = _getContext;
    this._contextManager = _contextManager;
    this._onSpanQueued = _onSpanQueued;
    this._queue = [];
    this._flushTimer = new FlushTimer(() => this._flushInBackground());
    this._flushPromise = null;
    this._droppedSinceWarning = 0;
    this._lastDropWarningAt = 0;
    this._dropReasons = new Set;
    this._consecutiveFlushFailures = 0;
    this._flushJitter = NO_JITTER;
    this._retryAfter = new RetryAfterWindow;
    this._headBatchFailures = 0;
    this._headBatchSize = 0;
    this._headBatchChargeableAt = 0;
    this._generation = 0;
    this._liveSpans = new Map;
    this._maxExportBatchSize = _config.maxExportBatchSize;
  }
  startSpan(name, options) {
    if (this._instance.isDisabled || this._instance.optedOut)
      return inertSpan(options, this._contextManager.active());
    const explicitParent = traceparentHeader(options?.parent);
    if (explicitParent && typeof explicitParent != "string" && !isOwnSpan(explicitParent)) {
      if (looksLikeSpan(explicitParent)) {
        this._logger.debug("Span parent is not a span from this SDK; returning an inert span");
        return inertSpan(options, this._contextManager.active());
      }
      this._logger.debug("Ignoring an unusable span parent");
    }
    const parent = this._resolveParent(explicitParent, options);
    if (this._liveSpans.size >= this._config.maxLiveSpans)
      this._evictAgedSpans();
    if (this._liveSpans.size >= this._config.maxLiveSpans) {
      this._recordDrop(1, `the live-span limit (${this._config.maxLiveSpans}) was reached — spans are being started and never ended`);
      return inertSpan(options, this._contextManager.active());
    }
    const now = Date.now();
    const startTime = resolveStartTime(options?.startTime, now, this._logger);
    const spanId = newSpanId();
    this._liveSpans.set(spanId, clockNow());
    const autoAttributes = this._autoContextAttributes();
    return new PostHogSpan({
      traceId: parent?.traceId ?? newTraceId(),
      spanId,
      parentSpanId: parent?.parentSpanId,
      traceState: parent?.traceState,
      traceFlags: parent?.traceFlags,
      parentIsRemote: parent?.isRemote,
      name: sanitizeName(name, "Span name", this._config.maxAttributeValueLength, this._logger),
      kind: options?.kind ?? "internal",
      attributes: assignUserAttributes({
        ...autoAttributes
      }, options?.attributes),
      autoAttributeKeys: Object.keys(autoAttributes),
      maxAttributes: this._config.maxAttributesPerSpan,
      maxEvents: this._config.maxEventsPerSpan,
      maxAttributesPerEvent: this._config.maxAttributesPerEvent,
      maxAttributeValueLength: this._config.maxAttributeValueLength,
      startTime,
      backdated: startTime !== now,
      clockAnchor: toEpochMs(options?.startTime) === undefined ? parent?.clockAnchor : undefined
    }, (record, autoKeys) => this._onSpanEnd(record, autoKeys), this._logger);
  }
  withSpan(name, optionsOrFn, maybeFn) {
    const options = typeof optionsOrFn == "function" ? undefined : optionsOrFn;
    const fn = typeof optionsOrFn == "function" ? optionsOrFn : maybeFn;
    const span = this.startSpan(name, options);
    try {
      const result = runWithActiveSpan(this._contextManager, span, fn);
      if (isPromise(result))
        return result.then((value) => {
          span.end();
          return value;
        }, (error) => {
          this._recordCallbackError(span, error);
          span.end();
          throw error;
        });
      span.end();
      return result;
    } catch (error) {
      this._recordCallbackError(span, error);
      span.end();
      throw error;
    }
  }
  getActiveSpan() {
    return this._contextManager.active() ?? null;
  }
  get throttled() {
    return this._retryAfter.isOpen();
  }
  async flush() {
    for (;; ) {
      if (!this._queue.length)
        return;
      const inFlight = this._flushPromise;
      const removed = await (inFlight ?? this._startFlush());
      if (!removed)
        return;
    }
  }
  _startFlush() {
    this._flushTimer.clear();
    const startedAtGeneration = this._generation;
    const promise = Promise.resolve().then(() => startedAtGeneration === this._generation ? this._flushInner() : 0).finally(() => {
      if (this._flushPromise === promise)
        this._flushPromise = null;
      this._armFlushTimerIfQueuedNoEarlierThan();
    });
    this._flushPromise = promise;
    return promise;
  }
  reset() {
    this._flushTimer.clear();
    if (this._queue.length)
      this._logger.critical(`Discarding ${this._queue.length} span(s) that were still queued when tracing was shut down. Raise the shutdown timeout or flush earlier if they matter.`);
    this._queue = [];
    this._liveSpans.clear();
    this._flushPromise = null;
    this._generation++;
    this._maxExportBatchSize = this._config.maxExportBatchSize;
    this._droppedSinceWarning = 0;
    this._dropReasons.clear();
    this._lastDropWarningAt = 0;
    this._consecutiveFlushFailures = 0;
    this._flushJitter = NO_JITTER;
    this._retryAfter.reset();
    this._resetHeadBatchBudget();
  }
  _resetHeadBatchBudget() {
    this._headBatchFailures = 0;
    this._headBatchChargeableAt = 0;
  }
  _resolveParent(explicit, options) {
    if (typeof explicit == "string") {
      const remote = remoteContext(explicit, options?.tracestate);
      if (!remote)
        this._logger.debug("Ignoring malformed traceparent; starting a new trace");
      return remote;
    }
    if (isOwnSpan(explicit))
      return explicit.childContext();
    const active = this._contextManager.active();
    if (isOwnSpan(active))
      return active.childContext();
    if (active instanceof PassThroughSpan)
      return remoteContext(active.traceparent(), active.tracestate() ?? undefined);
  }
  _autoContextAttributes() {
    let context;
    try {
      context = this._getContext();
    } catch (error) {
      this._logger.debug("Failed to read tracing context; span will carry no PostHog attributes", error);
      return {};
    }
    const attributes = {};
    if (context.distinctId)
      attributes.posthogDistinctId = context.distinctId;
    if (context.sessionId)
      attributes.sessionId = context.sessionId;
    if (context.currentUrl)
      attributes["url.full"] = context.currentUrl;
    if (context.screenName)
      attributes["screen.name"] = context.screenName;
    if (context.appState)
      attributes["app.state"] = context.appState;
    return attributes;
  }
  _recordCallbackError(span, error) {
    if (!(span instanceof PostHogSpan))
      return;
    const { type, message, stack } = describeError2(error);
    span.addEvent("exception", {
      "exception.type": type,
      "exception.message": message,
      ...stack && {
        "exception.stacktrace": stack
      }
    });
    if (!span.statusIsExplicitlyOk)
      span.setStatus("error", message);
  }
  _evictAgedSpans() {
    const cutoff = clockNow() - this._config.maxSpanAgeMs;
    let evicted = 0;
    for (const [spanId, startedAt] of this._liveSpans) {
      if (startedAt > cutoff)
        break;
      this._liveSpans.delete(spanId);
      evicted++;
    }
    if (evicted)
      this._recordDrop(evicted, `they were still live after ${this._config.maxSpanAgeMs}ms`);
  }
  _onSpanEnd(incoming, autoKeys) {
    if (!this._liveSpans.delete(incoming.spanId))
      return;
    if (this._instance.isDisabled || this._instance.optedOut)
      return void this._recordDrop(1, "the user has opted out");
    const record = this._runBeforeSpanSend(incoming, autoKeys);
    if (!record)
      return;
    this._reportLimitDrops(record);
    if (this._queue.length >= this._config.maxQueueSize)
      return void this._recordDrop(1, `the queue is full (${this._config.maxQueueSize}) — raise the flush frequency or reduce span volume`);
    this._queue.push(record);
    try {
      this._onSpanQueued?.();
    } catch (error) {
      this._logger.debug("Span queue notification failed", error);
    }
    if (!(this._queue.length >= this._maxExportBatchSize) || this._consecutiveFlushFailures || this._retryAfter.isOpen())
      this._armFlushTimerIfQueued();
    else
      this._flushInBackground();
  }
  _reportLimitDrops(record) {
    const attributes = record.droppedAttributesCount ?? 0;
    const events = record.droppedEventsCount ?? 0;
    let eventAttributes = 0;
    for (const event of record.events)
      eventAttributes += event.droppedAttributesCount ?? 0;
    if (attributes || events || eventAttributes)
      this._logger.debug(`Span limits discarded data from "${record.name}": ${attributes} attributes, ${events} events, ${eventAttributes} event attributes`);
  }
  _runBeforeSpanSend(record, autoKeys) {
    if (!this._config.beforeSpanSend.length)
      return record;
    const identity = {
      traceId: record.traceId,
      spanId: record.spanId,
      parentSpanId: record.parentSpanId,
      traceState: record.traceState
    };
    const originalTimes = {
      startTime: record.startTime,
      endTime: record.endTime
    };
    const originalDropped = {
      attributes: record.droppedAttributesCount,
      events: record.droppedEventsCount
    };
    const keysBeforeHook = Object.keys(record.attributes);
    const originalPropagation = {
      traceFlags: record.traceFlags,
      parentIsRemote: record.parentIsRemote
    };
    const originalStatus = record.status && {
      ...record.status
    };
    let hooked = record;
    let current = record;
    try {
      for (const hook of this._config.beforeSpanSend) {
        const result = hook(hooked);
        if (!result) {
          this._recordDrop(1, "beforeSpanSend dropped it");
          return null;
        }
        hooked = this._keepSpanIdentity(result, identity);
      }
      const rebuilt = {
        traceId: identity.traceId,
        spanId: identity.spanId,
        parentSpanId: identity.parentSpanId,
        traceState: identity.traceState,
        name: hooked.name,
        kind: hooked.kind,
        status: hooked.status,
        attributes: hooked.attributes,
        events: hooked.events,
        startTime: hooked.startTime,
        endTime: hooked.endTime,
        traceFlags: originalPropagation.traceFlags,
        parentIsRemote: originalPropagation.parentIsRemote,
        droppedAttributesCount: originalDropped.attributes,
        droppedEventsCount: originalDropped.events
      };
      current = rebuilt;
      if (!isSpanRecordShape(current)) {
        this._logger.debug("beforeSpanSend did not return a span record; dropping the span");
        this._recordDrop(1, "beforeSpanSend returned an unusable record");
        return null;
      }
      current.name = sanitizeName(current.name, "Span name", this._config.maxAttributeValueLength, this._logger);
      if (current.status && current.status.code !== "ok" && current.status.code !== "error") {
        this._logger.debug("beforeSpanSend set an unknown span status; keeping the original");
        current.status = originalStatus;
      }
      current.startTime = toEpochMs(current.startTime) ?? originalTimes.startTime;
      current.endTime = clampEndTime(toEpochMs(current.endTime) ?? originalTimes.endTime, current.startTime);
      const sanitizedEvents = [];
      for (const event of current.events)
        try {
          sanitizedEvents.push({
            ...event,
            name: sanitizeName(event.name, "Span event name", this._config.maxAttributeValueLength, this._logger),
            timestamp: resolveSuppliedTime(event.timestamp, current.startTime, "event timestamp", this._logger)
          });
        } catch {
          this._logger.debug("beforeSpanSend left an unreadable span event; dropping it");
        }
      current.events = sanitizedEvents;
      applySpanLimits(current, autoKeys, this._config.maxAttributesPerSpan, this._config.maxEventsPerSpan, this._config.maxAttributesPerEvent, this._config.maxAttributeValueLength, keysBeforeHook);
      return current;
    } catch (error) {
      this._logger.debug("beforeSpanSend failed; dropping the span rather than exporting it unscrubbed", error);
      this._recordDrop(1, "beforeSpanSend failed");
      return null;
    }
  }
  _keepSpanIdentity(hooked, original) {
    if (hooked.traceId !== original.traceId || hooked.spanId !== original.spanId || hooked.parentSpanId !== original.parentSpanId)
      this._logger.debug("beforeSpanSend changed a span identity field; keeping the original ids");
    try {
      restoreField(hooked, "traceId", original.traceId);
      restoreField(hooked, "spanId", original.spanId);
      restoreField(hooked, "parentSpanId", original.parentSpanId);
      restoreField(hooked, "traceState", original.traceState);
    } catch {
      return withRestoredIdentity(hooked, original);
    }
    return hooked;
  }
  _recordDrop(count, reason) {
    this._droppedSinceWarning += count;
    this._dropReasons.add(reason);
    if (Date.now() - this._lastDropWarningAt >= this._config.flushIntervalMs)
      this._warnAboutDrops();
  }
  _warnAboutDrops() {
    if (!this._droppedSinceWarning)
      return;
    this._lastDropWarningAt = Date.now();
    this._logger.warn(`Dropping ${this._droppedSinceWarning} span(s): ${[
      ...this._dropReasons
    ].join("; ")}`);
    this._droppedSinceWarning = 0;
    this._dropReasons.clear();
  }
  _encodeBatch(batch) {
    const encoded = [];
    for (const record of batch)
      try {
        encoded.push(buildOtlpSpan(record, this._logger));
      } catch (error) {
        this._logger.debug("Failed to encode a span; dropping it", error);
        this._recordDrop(1, "its attributes could not be encoded");
      }
    return encoded;
  }
  _discardQueueIfConsentWithdrawn() {
    if (!this._instance.isDisabled && !this._instance.optedOut)
      return 0;
    const discarded = this._queue.length;
    this._queue = [];
    this._resetHeadBatchBudget();
    this._recordDrop(discarded, "the user has opted out");
    this._warnAboutDrops();
    return discarded;
  }
  async _flushInner() {
    if (!this._queue.length)
      return 0;
    const discardedBeforeDrain = this._discardQueueIfConsentWithdrawn();
    if (discardedBeforeDrain)
      return discardedBeforeDrain;
    const resourceAttributes = truncateAttributes(buildTracesResourceAttributes(this._config, this._instance.getLibraryId(), this._instance.getLibraryVersion()), this._config.maxAttributeValueLength);
    const scopeName = this._instance.getLibraryId();
    const scopeVersion = this._instance.getLibraryVersion();
    let remaining = this._queue.length;
    let removed = 0;
    let localCap = 1 / 0;
    const generation = this._generation;
    try {
      while (remaining > 0 && this._queue.length > 0) {
        const discardedMidDrain = this._discardQueueIfConsentWithdrawn();
        if (discardedMidDrain)
          return removed + discardedMidDrain;
        const cap = this._headBatchFailures > 0 ? Math.min(this._maxExportBatchSize, this._headBatchSize) : this._maxExportBatchSize;
        const size = Math.max(1, Math.min(cap, localCap, remaining, this._queue.length));
        const batch = this._queue.slice(0, size);
        const spans = this._encodeBatch(batch);
        if (!spans.length) {
          this._queue.splice(0, size);
          remaining -= size;
          removed += size;
          this._resetHeadBatchBudget();
          continue;
        }
        const chargeable = clockNow() >= this._headBatchChargeableAt && !this._retryAfter.isOpen();
        const outcome = await this._instance._sendTracesBatch(buildOtlpTracesPayload(spans, resourceAttributes, scopeName, scopeVersion, this._logger));
        if (generation !== this._generation)
          break;
        this._retryAfter.record(outcome);
        if (outcome.kind === "ok") {
          this._consecutiveFlushFailures = 0;
          this._flushJitter = NO_JITTER;
          this._resetHeadBatchBudget();
          this._queue.splice(0, size);
          remaining -= size;
          removed += size;
          if (this._maxExportBatchSize < this._config.maxExportBatchSize)
            this._maxExportBatchSize++;
          continue;
        }
        if (outcome.kind === "too-large") {
          if (size === 1) {
            this._queue.splice(0, 1);
            remaining -= 1;
            removed += 1;
            this._recordDrop(1, "it is too large for the ingestion endpoint");
            this._consecutiveFlushFailures = 0;
            this._flushJitter = NO_JITTER;
            this._resetHeadBatchBudget();
            continue;
          }
          const halved = Math.max(1, Math.floor(size / 2));
          if (outcome.measuredLocally)
            localCap = halved;
          else
            this._maxExportBatchSize = halved;
          this._resetHeadBatchBudget();
          this._logger.debug(`Batch too large; retrying the same spans in batches of ${halved}`);
          continue;
        }
        if (outcome.kind === "retry-later") {
          this._consecutiveFlushFailures++;
          this._flushJitter = drawJitter();
          this._headBatchSize = size;
          if (chargeable) {
            this._headBatchFailures++;
            this._headBatchChargeableAt = clockNow() + this._nextFlushDelay();
          }
          if (this._headBatchFailures < MAX_RETRIES_PER_BATCH) {
            this._logger.debug("Span export failed; retrying on the next flush", outcome.error);
            return removed;
          }
          this._queue.splice(0, size);
          remaining -= size;
          removed += size;
          this._consecutiveFlushFailures = 0;
          this._flushJitter = NO_JITTER;
          this._resetHeadBatchBudget();
          this._recordDrop(size, `the ingestion endpoint failed ${MAX_RETRIES_PER_BATCH} times in a row`);
          if (this._retryAfter.isOpen())
            return removed;
          continue;
        }
        this._logger.debug("Dropping a span batch the ingestion endpoint rejected", outcome.error);
        this._queue.splice(0, size);
        remaining -= size;
        removed += size;
        this._consecutiveFlushFailures = 0;
        this._flushJitter = NO_JITTER;
        this._resetHeadBatchBudget();
        this._recordDrop(size, "the ingestion endpoint rejected the batch");
      }
      return removed;
    } finally {
      this._warnAboutDrops();
    }
  }
  _flushInBackground() {
    if (this._backgroundFlush)
      return;
    this._backgroundFlush = this.flush().catch((error) => {
      this._logger.debug("Background span flush failed", error);
    }).finally(() => {
      this._backgroundFlush = undefined;
      this._armFlushTimerIfQueuedNoEarlierThan();
    });
  }
  _armFlushTimerIfQueued() {
    if (this._flushTimer.pending || !this._queue.length)
      return;
    this._flushTimer.arm(this._nextFlushDelay());
  }
  _armFlushTimerIfQueuedNoEarlierThan() {
    if (!this._queue.length)
      return;
    this._flushTimer.armNoEarlierThan(this._nextFlushDelay());
  }
  _nextFlushDelay() {
    return Math.max(backoffDelayMs(this._config.flushIntervalMs, this._consecutiveFlushFailures, this._flushJitter, MAX_FLUSH_BACKOFF_MS), this._retryAfter.remainingMs());
  }
}
var MAX_RETRIES_PER_BATCH = 8;
var init_traces = __esm(() => {
  init_span();
  init_ids();
  init_traceparent();
  init_sanitize();
  init_json_utils();
  init_otlp();
  init_utils();
  init_flush_timer();
  init_retry_after();
  init_backoff();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/context.mjs
class SyncSpanContextManager {
  active() {
    return this._active;
  }
  with(span, fn) {
    const previous = this._active;
    this._active = span;
    try {
      return fn();
    } finally {
      this._active = previous;
    }
  }
}
var init_context = () => {};

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/traces/config.mjs
function positiveInteger(value, fallback) {
  return typeof value == "number" && Number.isInteger(value) && value >= 1 ? value : fallback;
}
function withUsableIdentityKeys(attributes) {
  if (!attributes || typeof attributes != "object" || Array.isArray(attributes))
    return;
  try {
    if (IDENTITY_KEYS.every((key) => !(key in attributes) || typeof attributes[key] == "string"))
      return attributes;
    const usable = {
      ...attributes
    };
    for (const key of IDENTITY_KEYS)
      if (key in usable && typeof usable[key] != "string")
        delete usable[key];
    return usable;
  } catch {
    return;
  }
}
function resolveBeforeSpanSend(beforeSpanSend, logger) {
  if (!beforeSpanSend)
    return [];
  const supplied = [
    beforeSpanSend
  ].flat().filter((hook) => Boolean(hook));
  const hooks = supplied.filter((hook) => typeof hook == "function");
  if (hooks.length !== supplied.length)
    logger?.critical(`beforeSpanSend: ignoring ${supplied.length - hooks.length} of ${supplied.length} entries that are not functions. Spans export without them, so whatever they were redacting is not redacted.`);
  return hooks;
}
function resolveTracesConfig(config, hostResourceAttributes, logger) {
  const resourceAttributes = assignUserAttributes({
    ...hostResourceAttributes
  }, withUsableIdentityKeys(config?.resourceAttributes));
  const maxExportBatchSize = positiveInteger(config?.maxExportBatchSize, DEFAULT_MAX_EXPORT_BATCH_SIZE);
  return {
    serviceName: resourceAttributes?.["service.name"] ?? config?.serviceName,
    serviceVersion: resourceAttributes?.["service.version"] ?? config?.serviceVersion,
    environment: resourceAttributes?.["deployment.environment"] ?? config?.environment,
    resourceAttributes,
    beforeSpanSend: resolveBeforeSpanSend(config?.beforeSpanSend, logger),
    maxAttributesPerSpan: positiveInteger(config?.maxAttributesPerSpan, DEFAULT_MAX_ATTRIBUTES_PER_SPAN),
    maxEventsPerSpan: positiveInteger(config?.maxEventsPerSpan, DEFAULT_MAX_EVENTS_PER_SPAN),
    maxAttributesPerEvent: DEFAULT_MAX_ATTRIBUTES_PER_EVENT,
    maxAttributeValueLength: positiveInteger(config?.maxAttributeValueLength, DEFAULT_MAX_ATTRIBUTE_VALUE_LENGTH),
    flushIntervalMs: positiveInteger(config?.flushIntervalMs, DEFAULT_FLUSH_INTERVAL_MS2),
    maxExportBatchSize,
    maxQueueSize: Math.max(positiveInteger(config?.maxQueueSize, DEFAULT_MAX_QUEUE_SIZE), maxExportBatchSize),
    maxLiveSpans: positiveInteger(config?.maxLiveSpans, DEFAULT_MAX_LIVE_SPANS),
    maxSpanAgeMs: positiveInteger(config?.maxSpanAgeMs, DEFAULT_MAX_SPAN_AGE_MS)
  };
}
var DEFAULT_FLUSH_INTERVAL_MS2 = 5000, DEFAULT_MAX_EXPORT_BATCH_SIZE = 512, DEFAULT_MAX_QUEUE_SIZE = 2048, DEFAULT_MAX_ATTRIBUTES_PER_SPAN = 128, DEFAULT_MAX_EVENTS_PER_SPAN = 128, DEFAULT_MAX_ATTRIBUTES_PER_EVENT = 128, DEFAULT_MAX_ATTRIBUTE_VALUE_LENGTH = 8192, DEFAULT_MAX_LIVE_SPANS = 1e4, DEFAULT_MAX_SPAN_AGE_MS = 3600000, IDENTITY_KEYS;
var init_config2 = __esm(() => {
  init_json_utils();
  IDENTITY_KEYS = [
    "service.name",
    "service.version",
    "deployment.environment"
  ];
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/surveys/validation.mjs
var init_validation = __esm(() => {
  init_types();
});

// ../../node_modules/.bun/@posthog+core@1.64.1/node_modules/@posthog/core/dist/index.mjs
var init_dist = __esm(() => {
  init_error_tracking();
  init_featureFlagUtils();
  init_featureFlagLocalEvaluation();
  init_gzip();
  init_logs_utils();
  init_otlp_any_value();
  init_otlp_resource();
  init_logs();
  init_metrics();
  init_traces();
  init_context();
  init_span();
  init_config2();
  init_uuidv7();
  init_validation();
  init_utils();
  init_cookie();
  init_posthog_core();
  init_posthog_core_stateless();
  init_privacy();
  init_tracing_headers();
  init_types();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/error-tracking/modifiers/context-lines.node.mjs
import { constants } from "node:fs";
import { open as promises_open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline";
async function addSourceContext(frames, openSourceFile = promises_open, logger) {
  const filesToLines = {};
  let basePath;
  try {
    basePath = process.cwd();
  } catch {}
  for (let i = frames.length - 1;i >= 0; i--) {
    const frame = frames[i];
    const filename = frame?.filename;
    if (!frame || typeof filename != "string" || typeof frame.lineno != "number" || shouldSkipContextLinesForFile(filename) || shouldSkipContextLinesForFrame(frame))
      continue;
    if (!isAbsolute(filename) && basePath === undefined)
      continue;
    const filesToLinesOutput = filesToLines[filename];
    if (!filesToLinesOutput)
      filesToLines[filename] = [];
    filesToLines[filename].push(frame.lineno);
  }
  const files = Object.keys(filesToLines);
  if (files.length == 0)
    return frames;
  const readlinePromises = [];
  for (const file of files) {
    const cacheKey = makeSourceCacheKey(file, basePath);
    if (cacheKey === undefined)
      continue;
    if (LRU_FILE_CONTENTS_FS_READ_FAILED.get(cacheKey))
      continue;
    const filesToLineRanges = filesToLines[file];
    if (!filesToLineRanges)
      continue;
    filesToLineRanges.sort((a, b) => a - b);
    const ranges = makeLineReaderRanges(filesToLineRanges);
    if (ranges.every((r) => rangeExistsInContentCache(cacheKey, r)))
      continue;
    const cache = emplace(LRU_FILE_CONTENTS_CACHE, cacheKey, {});
    readlinePromises.push(getContextLinesFromFile(file, ranges, cache, cacheKey, openSourceFile, logger));
  }
  await Promise.all(readlinePromises).catch(() => {});
  if (frames && frames.length > 0)
    addSourceContextToFrames(frames, LRU_FILE_CONTENTS_CACHE, basePath);
  LRU_FILE_CONTENTS_CACHE.reduce();
  return frames;
}
async function openRegularSourceFile(path, openSourceFile, logger) {
  let fileHandle;
  let isValid = false;
  try {
    fileHandle = await openSourceFile(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const fileStat = await fileHandle.stat();
    if (!fileStat.isFile())
      return;
    if (fileStat.size > MAX_CONTEXTLINES_FILE_SIZE)
      return void logger?.debug(`Skipping source context for oversized file ${path}: ${fileStat.size} bytes exceeds ${MAX_CONTEXTLINES_FILE_SIZE}`);
    isValid = true;
    return fileHandle;
  } catch {
    return;
  } finally {
    if (fileHandle && !isValid)
      await fileHandle.close().catch(() => {});
  }
}
async function getContextLinesFromFile(path, ranges, output, cacheKey, openSourceFile, logger) {
  const fileHandle = await openRegularSourceFile(path, openSourceFile, logger);
  if (fileHandle === undefined)
    return void LRU_FILE_CONTENTS_FS_READ_FAILED.set(cacheKey, 1);
  const openedFileHandle = fileHandle;
  return new Promise((resolve) => {
    let finished = false;
    function destroyStreamAndResolve(stream) {
      if (finished)
        return;
      finished = true;
      stream?.destroy();
      openedFileHandle.close().then(resolve, resolve);
    }
    let stream;
    try {
      stream = openedFileHandle.createReadStream({
        autoClose: false,
        start: 0,
        end: MAX_CONTEXTLINES_FILE_SIZE - 1
      });
    } catch {
      LRU_FILE_CONTENTS_FS_READ_FAILED.set(cacheKey, 1);
      destroyStreamAndResolve();
      return;
    }
    let lineReaded;
    try {
      lineReaded = createInterface({
        input: stream
      });
    } catch {
      LRU_FILE_CONTENTS_FS_READ_FAILED.set(cacheKey, 1);
      destroyStreamAndResolve(stream);
      return;
    }
    let lineNumber = 0;
    let currentRangeIndex = 0;
    const range = ranges[currentRangeIndex];
    if (range === undefined)
      return void destroyStreamAndResolve(stream);
    let rangeStart = range[0];
    let rangeEnd = range[1];
    function onStreamError() {
      LRU_FILE_CONTENTS_FS_READ_FAILED.set(cacheKey, 1);
      lineReaded.close();
      lineReaded.removeAllListeners();
      destroyStreamAndResolve(stream);
    }
    stream.on("error", onStreamError);
    lineReaded.on("error", onStreamError);
    lineReaded.on("close", () => destroyStreamAndResolve(stream));
    lineReaded.on("line", (line) => {
      lineNumber++;
      if (lineNumber < rangeStart)
        return;
      output[lineNumber] = snipLine(line, 0);
      if (lineNumber >= rangeEnd) {
        if (currentRangeIndex === ranges.length - 1) {
          lineReaded.close();
          lineReaded.removeAllListeners();
          return;
        }
        currentRangeIndex++;
        const range = ranges[currentRangeIndex];
        if (range === undefined) {
          lineReaded.close();
          lineReaded.removeAllListeners();
          return;
        }
        rangeStart = range[0];
        rangeEnd = range[1];
      }
    });
  });
}
function addSourceContextToFrames(frames, cache, basePath) {
  for (const frame of frames)
    if (frame.filename && frame.context_line === undefined && typeof frame.lineno == "number") {
      const cacheKey = makeSourceCacheKey(frame.filename, basePath);
      const contents = cacheKey === undefined ? undefined : cache.get(cacheKey);
      if (contents === undefined)
        continue;
      addContextToFrame(frame.lineno, frame, contents);
    }
}
function addContextToFrame(lineno, frame, contents) {
  if (frame.lineno === undefined || contents === undefined)
    return;
  frame.pre_context = [];
  for (let i = makeRangeStart(lineno);i < lineno; i++) {
    const line = contents[i];
    if (line === undefined)
      return void clearLineContext(frame);
    frame.pre_context.push(line);
  }
  if (contents[lineno] === undefined)
    return void clearLineContext(frame);
  frame.context_line = contents[lineno];
  const end = makeRangeEnd(lineno);
  frame.post_context = [];
  for (let i = lineno + 1;i <= end; i++) {
    const line = contents[i];
    if (line === undefined)
      break;
    frame.post_context.push(line);
  }
}
function clearLineContext(frame) {
  delete frame.pre_context;
  delete frame.context_line;
  delete frame.post_context;
}
function shouldSkipContextLinesForFile(path) {
  return path.startsWith("node:") || path.endsWith(".min.js") || path.endsWith(".min.cjs") || path.endsWith(".min.mjs") || path.startsWith("data:");
}
function shouldSkipContextLinesForFrame(frame) {
  if (frame.lineno !== undefined && frame.lineno > MAX_CONTEXTLINES_LINENO)
    return true;
  if (frame.colno !== undefined && frame.colno > MAX_CONTEXTLINES_COLNO)
    return true;
  return false;
}
function makeSourceCacheKey(path, basePath) {
  if (isAbsolute(path))
    return JSON.stringify([
      null,
      path
    ]);
  return basePath === undefined ? undefined : JSON.stringify([
    basePath,
    path
  ]);
}
function rangeExistsInContentCache(cacheKey, range) {
  const contents = LRU_FILE_CONTENTS_CACHE.get(cacheKey);
  if (contents === undefined)
    return false;
  for (let i = range[0];i <= range[1]; i++)
    if (contents[i] === undefined)
      return false;
  return true;
}
function makeLineReaderRanges(lines) {
  if (!lines.length)
    return [];
  let i = 0;
  const line = lines[0];
  if (typeof line != "number")
    return [];
  let current = makeContextRange(line);
  const out = [];
  while (true) {
    if (i === lines.length - 1) {
      out.push(current);
      break;
    }
    const next = lines[i + 1];
    if (typeof next != "number")
      break;
    if (next <= current[1])
      current[1] = next + DEFAULT_LINES_OF_CONTEXT;
    else {
      out.push(current);
      current = makeContextRange(next);
    }
    i++;
  }
  return out;
}
function makeContextRange(line) {
  return [
    makeRangeStart(line),
    makeRangeEnd(line)
  ];
}
function makeRangeStart(line) {
  return Math.max(1, line - DEFAULT_LINES_OF_CONTEXT);
}
function makeRangeEnd(line) {
  return line + DEFAULT_LINES_OF_CONTEXT;
}
function emplace(map, key, contents) {
  const value = map.get(key);
  if (value === undefined) {
    map.set(key, contents);
    return contents;
  }
  return value;
}
function snipLine(line, colno) {
  let newLine = line;
  const lineLength = newLine.length;
  if (lineLength <= 150)
    return newLine;
  if (colno > lineLength)
    colno = lineLength;
  let start = Math.max(colno - 60, 0);
  if (start < 5)
    start = 0;
  let end = Math.min(start + 140, lineLength);
  if (end > lineLength - 5)
    end = lineLength;
  if (end === lineLength)
    start = Math.max(end - 140, 0);
  newLine = newLine.slice(start, end);
  if (start > 0)
    newLine = `...${newLine}`;
  if (end < lineLength)
    newLine += "...";
  return newLine;
}
var LRU_FILE_CONTENTS_CACHE, LRU_FILE_CONTENTS_FS_READ_FAILED, DEFAULT_LINES_OF_CONTEXT = 7, MAX_CONTEXTLINES_COLNO = 1000, MAX_CONTEXTLINES_LINENO = 1e4, MAX_CONTEXTLINES_FILE_SIZE = 10485760;
var init_context_lines_node = __esm(() => {
  init_dist();
  LRU_FILE_CONTENTS_CACHE = new ReduceableCache(25);
  LRU_FILE_CONTENTS_FS_READ_FAILED = new ReduceableCache(20);
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/error-tracking/modifiers/relative-path.node.mjs
import { isAbsolute as isAbsolute2, relative, sep as sep2 } from "path";
function createRelativePathModifier(basePath = process.cwd()) {
  const isWindows = sep2 === "\\";
  const toUnix = (p) => isWindows ? p.replace(/\\/g, "/") : p;
  const normalizedBase = toUnix(basePath);
  return async (frames) => {
    for (const frame of frames)
      if (!(!frame.filename || frame.filename.startsWith("node:") || frame.filename.startsWith("data:"))) {
        if (isAbsolute2(frame.filename))
          frame.filename = toUnix(relative(normalizedBase, toUnix(frame.filename)));
      }
    return frames;
  };
}
var init_relative_path_node = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/version.mjs
var version2 = "5.63.1";
var init_version = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/types.mjs
var FeatureFlagError2;
var init_types3 = __esm(() => {
  FeatureFlagError2 = {
    ERRORS_WHILE_COMPUTING: "errors_while_computing_flags",
    FLAG_MISSING: "flag_missing",
    LOCAL_EVALUATION_INCONCLUSIVE: "local_evaluation_inconclusive",
    QUOTA_LIMITED: "quota_limited",
    UNKNOWN_ERROR: "unknown_error"
  };
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/feature-flag-evaluations.mjs
class FeatureFlagEvaluations {
  constructor(init) {
    this._host = init.host;
    this._distinctId = init.distinctId;
    this._groups = init.groups;
    this._disableGeoip = init.disableGeoip;
    this._flags = init.flags;
    this._unresolvedFlags = Object.freeze({
      ...init.unresolvedFlags
    });
    this._requestId = init.requestId;
    this._evaluatedAt = init.evaluatedAt;
    this._flagDefinitionsLoadedAt = init.flagDefinitionsLoadedAt;
    this._errorsWhileComputing = init.errorsWhileComputing ?? false;
    this._quotaLimited = init.quotaLimited ?? false;
    this._accessed = init.accessed ?? new Set;
    this._isSlice = init.isSlice ?? false;
  }
  isEnabled(key, options = {}) {
    const flag = this._flags[key];
    this._recordAccess(key, options.sendFeatureFlagEvents);
    return flag?.enabled ?? options.defaultValue ?? false;
  }
  getFlag(key, options = {}) {
    const flag = this._flags[key];
    this._recordAccess(key, options.sendFeatureFlagEvents);
    if (!flag)
      return;
    if (!flag.enabled)
      return false;
    return flag.variant ?? true;
  }
  getFlagPayload(key) {
    return this._flags[key]?.payload;
  }
  onlyAccessed() {
    const filtered = {};
    for (const key of this._accessed) {
      const flag = this._flags[key];
      if (flag)
        filtered[key] = flag;
    }
    return this._cloneWith(filtered);
  }
  only(keys) {
    const filtered = {};
    const missing = [];
    for (const key of keys) {
      const flag = this._flags[key];
      if (flag)
        filtered[key] = flag;
      else
        missing.push(key);
    }
    if (missing.length > 0)
      this._host.logWarning(`FeatureFlagEvaluations.only() was called with flag keys that are not in the evaluation set and will be dropped: ${missing.join(", ")}`);
    return this._cloneWith(filtered);
  }
  get keys() {
    return Object.keys(this._flags);
  }
  get unresolvedFlags() {
    return this._unresolvedFlags;
  }
  _getEventProperties() {
    const properties = {};
    const activeFlags = [];
    for (const [key, flag] of Object.entries(this._flags)) {
      const value = flag.enabled === false ? false : flag.variant ?? true;
      properties[`$feature/${key}`] = value;
      if (flag.enabled)
        activeFlags.push(key);
    }
    if (activeFlags.length > 0) {
      activeFlags.sort();
      properties["$active_feature_flags"] = activeFlags;
    }
    return properties;
  }
  _cloneWith(flags) {
    return new FeatureFlagEvaluations({
      host: this._host,
      distinctId: this._distinctId,
      groups: this._groups,
      disableGeoip: this._disableGeoip,
      flags,
      requestId: this._requestId,
      evaluatedAt: this._evaluatedAt,
      flagDefinitionsLoadedAt: this._flagDefinitionsLoadedAt,
      errorsWhileComputing: this._errorsWhileComputing,
      quotaLimited: this._quotaLimited,
      accessed: new Set(this._accessed),
      isSlice: true
    });
  }
  _recordAccess(key, sendFeatureFlagEvents) {
    this._accessed.add(key);
    if (!this._host.resolveSendFeatureFlagEvents(sendFeatureFlagEvents))
      return;
    if (this._distinctId === "")
      return;
    if (this._isSlice && !(key in this._flags))
      return;
    const flag = this._flags[key];
    const response = flag === undefined ? undefined : flag.enabled === false ? false : flag.variant ?? true;
    const properties = {
      $feature_flag: key,
      $feature_flag_response: response,
      $feature_flag_id: flag?.id,
      $feature_flag_version: flag?.version,
      $feature_flag_reason: flag?.reason,
      locally_evaluated: flag?.locallyEvaluated ?? false,
      [`$feature/${key}`]: response,
      $feature_flag_request_id: this._requestId,
      $feature_flag_evaluated_at: flag?.locallyEvaluated ? Date.now() : this._evaluatedAt
    };
    if (flag?.hasExperiment !== undefined)
      properties.$feature_flag_has_experiment = flag.hasExperiment;
    if (flag?.locallyEvaluated && this._flagDefinitionsLoadedAt !== undefined)
      properties.$feature_flag_definitions_loaded_at = this._flagDefinitionsLoadedAt;
    const errors = [];
    if (this._errorsWhileComputing)
      errors.push(FeatureFlagError2.ERRORS_WHILE_COMPUTING);
    if (this._quotaLimited)
      errors.push(FeatureFlagError2.QUOTA_LIMITED);
    if (flag === undefined)
      errors.push(Object.prototype.hasOwnProperty.call(this._unresolvedFlags, key) ? FeatureFlagError2.LOCAL_EVALUATION_INCONCLUSIVE : FeatureFlagError2.FLAG_MISSING);
    if (errors.length > 0)
      properties.$feature_flag_error = errors.join(",");
    this._host.captureFlagCalledEventIfNeeded({
      distinctId: this._distinctId,
      key,
      response,
      groups: this._groups,
      disableGeoip: this._disableGeoip,
      properties
    });
  }
}
var init_feature_flag_evaluations = __esm(() => {
  init_types3();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/feature-flags/feature-flags.mjs
function normalizeEvaluationRuntime(value) {
  return value === "client" || value === "server" ? value : "all";
}
function evaluationRuntimesMatch(a, b) {
  return a === b || a === "all" || b === "all";
}
function setCustomErrorPrototype(error, constructor) {
  error.name = constructor.name;
  Error.captureStackTrace(error, constructor);
  Object.setPrototypeOf(error, constructor.prototype);
}
function pickUnresolvedReason(current, next) {
  if (current === undefined)
    return next;
  return UNRESOLVED_REASON_PRECEDENCE.indexOf(next) < UNRESOLVED_REASON_PRECEDENCE.indexOf(current) ? next : current;
}
function preserveRegexUncertainty(error, original) {
  if (original instanceof InconclusiveMatchError && Symbol.for("posthog.requiresServerRegexEvaluation") in original)
    Object.defineProperty(error, Symbol.for("posthog.requiresServerRegexEvaluation"), {
      value: true
    });
  return error;
}

class FeatureFlagsPoller {
  constructor({ pollingInterval, personalApiKey, projectApiKey, timeout, host, customHeaders, ...options }) {
    this.debugMode = false;
    this.shouldBeginExponentialBackoff = false;
    this.backOffCount = 0;
    this.pollerStopped = false;
    this.filteredOutFlagKeys = new Set;
    this.warnedUnresolvableFlags = new Map;
    this.pollingInterval = pollingInterval;
    this.personalApiKey = personalApiKey;
    this.featureFlags = [];
    this.featureFlagsByKey = {};
    this.groupTypeMapping = {};
    this.cohorts = {};
    this.loadedSuccessfullyOnce = false;
    this.timeout = timeout;
    this.projectApiKey = projectApiKey;
    this.host = host;
    this.poller = undefined;
    this.fetch = options.fetch || fetch;
    this.onError = options.onError;
    this.customHeaders = customHeaders;
    this.onLoad = options.onLoad;
    this.onMinimalFlagCalledEvents = options.onMinimalFlagCalledEvents;
    this.cacheProvider = options.cacheProvider;
    this.strictLocalEvaluation = options.strictLocalEvaluation ?? false;
    this.evaluationContexts = options.evaluationContexts;
    this.loadFeatureFlags();
  }
  debug(enabled = true) {
    this.debugMode = enabled;
  }
  logMsgIfDebug(fn) {
    if (this.debugMode)
      fn();
  }
  currentDefinitions() {
    return {
      featureFlagsByKey: this.featureFlagsByKey,
      groupTypeMapping: this.groupTypeMapping,
      cohorts: this.cohorts,
      filteredOutFlagKeys: this.filteredOutFlagKeys,
      propertyMatchingVersion: this.propertyMatchingVersion
    };
  }
  withEvaluationSnapshot(context) {
    if (context.definitions)
      return context;
    return {
      ...context,
      evaluationCache: {},
      definitions: this.currentDefinitions()
    };
  }
  createEvaluationContext(distinctId, groups = {}, personProperties = {}, groupProperties = {}, evaluationCache = {}) {
    return {
      distinctId,
      groups,
      personProperties,
      groupProperties,
      evaluationCache
    };
  }
  async getFeatureFlag(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}) {
    await this.loadFeatureFlags();
    let response;
    let featureFlag;
    if (!this.loadedSuccessfullyOnce)
      return response;
    featureFlag = this.featureFlagsByKey[key];
    if (featureFlag !== undefined) {
      const evaluationContext = this.createEvaluationContext(distinctId, groups, personProperties, groupProperties);
      try {
        const result = await this.computeFlagAndPayloadLocally(featureFlag, evaluationContext);
        response = result.value;
        this.logMsgIfDebug(() => console.debug(`Successfully computed flag locally: ${key} -> ${response}`));
      } catch (e) {
        if (e instanceof RequiresServerEvaluation || e instanceof InconclusiveMatchError)
          this.logMsgIfDebug(() => console.debug(`${e.name} when computing flag locally: ${key}: ${e.message}`));
        else if (e instanceof Error)
          this.onError?.(new Error(`Error computing flag locally: ${key}: ${e}`));
      }
    }
    return response;
  }
  async getAllFlagsAndPayloads(evaluationContext, flagKeysToExplicitlyEvaluate) {
    await this.loadFeatureFlags();
    const response = {};
    const payloads = {};
    const unresolved = {};
    let fallbackToFlags = this.featureFlags.length == 0;
    const flagsToEvaluate = flagKeysToExplicitlyEvaluate ? flagKeysToExplicitlyEvaluate.map((key) => this.featureFlagsByKey[key]).filter(Boolean) : this.featureFlags;
    const sharedEvaluationContext = this.withEvaluationSnapshot({
      ...evaluationContext,
      definitions: undefined
    });
    await Promise.all(flagsToEvaluate.map(async (flag) => {
      try {
        const { value: matchValue, payload: matchPayload } = await this.computeFlagAndPayloadLocally(flag, sharedEvaluationContext, {
          skipLoadCheck: true
        });
        response[flag.key] = matchValue;
        if (matchPayload)
          payloads[flag.key] = matchPayload;
      } catch (e) {
        if (e instanceof RequiresServerEvaluation || e instanceof InconclusiveMatchError) {
          this.logMsgIfDebug(() => console.debug(`${e.name} when computing flag locally: ${flag.key}: ${e.message}`));
          unresolved[flag.key] = e.reason;
        } else if (e instanceof Error)
          this.onError?.(new Error(`Error computing flag locally: ${flag.key}: ${e}`));
        if (evaluationRuntimesMatch(normalizeEvaluationRuntime(flag.evaluation_runtime), "server"))
          fallbackToFlags = true;
      }
    }));
    return {
      response,
      payloads,
      unresolved,
      fallbackToFlags
    };
  }
  async computeFlagAndPayloadLocally(flag, evaluationContext, options = {}) {
    const { matchValue, skipLoadCheck = false } = options;
    if (this.loadedSuccessfullyOnce)
      evaluationContext = this.withEvaluationSnapshot(evaluationContext);
    if (!skipLoadCheck)
      await this.loadFeatureFlags();
    if (!this.loadedSuccessfullyOnce)
      return {
        value: false,
        payload: null
      };
    evaluationContext = this.withEvaluationSnapshot(evaluationContext);
    flag = evaluationContext.definitions.featureFlagsByKey[flag.key] ?? flag;
    let flagValue;
    flagValue = matchValue !== undefined ? matchValue : await this.computeFlagValueLocally(flag, evaluationContext);
    const payload = resolveFeatureFlagPayload(flag.filters?.payloads, flagValue);
    return {
      value: flagValue,
      payload
    };
  }
  async computeFlagValueLocally(flag, evaluationContext) {
    const { distinctId, groups, personProperties, groupProperties } = evaluationContext;
    if (!flag.active)
      return false;
    if (flag.ensure_experience_continuity)
      throw new InconclusiveMatchError("Flag has experience continuity enabled", "experience_continuity");
    const flagFilters = flag.filters || {};
    const aggregation_group_type_index = flagFilters.aggregation_group_type_index;
    if (aggregation_group_type_index != null) {
      const groupName = evaluationContext.definitions.groupTypeMapping[String(aggregation_group_type_index)];
      if (!groupName) {
        this.logMsgIfDebug(() => console.warn(`[FEATURE FLAGS] Unknown group type index ${aggregation_group_type_index} for feature flag ${flag.key}`));
        throw new InconclusiveMatchError("Flag has unknown group type index");
      }
      if (!(groupName in groups)) {
        this.logMsgIfDebug(() => console.warn(`[FEATURE FLAGS] Can't compute group feature flag: ${flag.key} without group names passed in`));
        return false;
      }
      if (flag.bucketing_identifier === "device_id" && (personProperties?.$device_id === undefined || personProperties?.$device_id === null || personProperties?.$device_id === ""))
        this.logMsgIfDebug(() => console.warn(`[FEATURE FLAGS] Ignoring bucketing_identifier for group flag: ${flag.key}`));
      const focusedGroupProperties = groupProperties[groupName];
      return await this.matchFeatureFlagProperties(flag, groups[groupName], focusedGroupProperties, evaluationContext);
    }
    {
      const bucketingValue = this.getBucketingValueForFlag(flag, distinctId, personProperties);
      if (bucketingValue === undefined) {
        this.logMsgIfDebug(() => console.warn(`[FEATURE FLAGS] Can't compute feature flag: ${flag.key} without $device_id, falling back to server evaluation`));
        throw new InconclusiveMatchError(`Can't compute feature flag: ${flag.key} without $device_id`, getDefinitionUnresolvedReason(flag, evaluationContext.definitions) ?? "missing_context");
      }
      return await this.matchFeatureFlagProperties(flag, bucketingValue, personProperties, evaluationContext);
    }
  }
  getBucketingValueForFlag(flag, distinctId, properties) {
    if (flag.filters?.aggregation_group_type_index != null)
      return distinctId;
    if (flag.bucketing_identifier === "device_id") {
      const deviceId = properties?.$device_id;
      if (deviceId == null || deviceId === "")
        return;
      return deviceId;
    }
    return distinctId;
  }
  async evaluateFlagDependency(property, properties, evaluationContext) {
    const { evaluationCache } = evaluationContext;
    const targetFlagKey = property.key;
    if (!evaluationContext.definitions.featureFlagsByKey)
      throw new InconclusiveMatchError("Feature flags not available for dependency evaluation");
    if (!("dependency_chain" in property))
      throw new InconclusiveMatchError(`Flag dependency property for '${targetFlagKey}' is missing required 'dependency_chain' field`);
    const dependencyChain = property.dependency_chain;
    if (!Array.isArray(dependencyChain))
      throw new InconclusiveMatchError(`Flag dependency property for '${targetFlagKey}' has an invalid 'dependency_chain' (expected array, got ${typeof dependencyChain})`);
    if (dependencyChain.length === 0)
      throw new InconclusiveMatchError(`Circular dependency detected for flag '${targetFlagKey}' (empty dependency chain)`);
    const missingDependency = dependencyChain.find((depFlagKey) => !(depFlagKey in evaluationCache) && !evaluationContext.definitions.featureFlagsByKey[depFlagKey] && !evaluationContext.definitions.filteredOutFlagKeys.has(depFlagKey));
    if (missingDependency !== undefined)
      throw new InconclusiveMatchError(`Missing flag dependency '${missingDependency}' for flag '${targetFlagKey}'`);
    for (const depFlagKey of dependencyChain) {
      if (!(depFlagKey in evaluationCache)) {
        const depFlag = evaluationContext.definitions.featureFlagsByKey[depFlagKey];
        if (depFlag)
          if (depFlag.active)
            try {
              const depResult = await this.computeFlagValueLocally(depFlag, evaluationContext);
              evaluationCache[depFlagKey] = depResult;
            } catch (error) {
              if (error instanceof RequiresServerEvaluation)
                throw new RequiresServerEvaluation(`Flag dependency '${depFlagKey}' for flag '${targetFlagKey}' requires server evaluation: ${error.message}`, "unresolved_dependency");
              throw preserveRegexUncertainty(new InconclusiveMatchError(`Error evaluating flag dependency '${depFlagKey}' for flag '${targetFlagKey}': ${error}`, "unresolved_dependency"), error);
            }
          else
            evaluationCache[depFlagKey] = false;
        else
          evaluationCache[depFlagKey] = false;
      }
      const cachedResult = evaluationCache[depFlagKey];
      if (cachedResult == null)
        throw new InconclusiveMatchError(`Dependency '${depFlagKey}' could not be evaluated`, "unresolved_dependency");
    }
    const targetFlagValue = evaluationCache[targetFlagKey];
    return this.flagEvaluatesToExpectedValue(property.value, targetFlagValue);
  }
  flagEvaluatesToExpectedValue(expectedValue, flagValue) {
    if (typeof expectedValue == "boolean")
      return expectedValue === flagValue || typeof flagValue == "string" && flagValue !== "" && expectedValue === true;
    if (typeof expectedValue == "string")
      return flagValue === expectedValue;
    return false;
  }
  async matchFeatureFlagProperties(flag, bucketingValue, properties, evaluationContext) {
    evaluationContext = this.withEvaluationSnapshot(evaluationContext);
    const flagFilters = flag.filters || {};
    const holdoutVariant = await getHoldoutVariant(flagFilters.holdout, bucketingValue);
    if (holdoutVariant !== undefined)
      return holdoutVariant;
    const flagConditions = flagFilters.groups || [];
    const flagAggregation = flagFilters.aggregation_group_type_index;
    const earlyExitEnabled = flagFilters.early_exit ?? false;
    const { groups, groupProperties } = evaluationContext;
    let inconclusiveReason;
    let regexError;
    const deferredRegexValues = new Set;
    let result;
    for (const condition of flagConditions) {
      let effectiveBucketingValue = bucketingValue;
      try {
        const conditionAggregation = condition.aggregation_group_type_index !== undefined ? condition.aggregation_group_type_index : flagAggregation;
        let effectiveProperties = properties;
        if (conditionAggregation !== flagAggregation) {
          if (conditionAggregation != null) {
            const groupName = evaluationContext.definitions.groupTypeMapping[String(conditionAggregation)];
            if (!groupName || !(groupName in groups)) {
              this.logMsgIfDebug(() => console.debug(`[FEATURE FLAGS] Skipping group condition for flag '${flag.key}': group type index ${conditionAggregation} not available`));
              continue;
            }
            if (!(groupName in groupProperties)) {
              inconclusiveReason = pickUnresolvedReason(inconclusiveReason, "missing_context");
              continue;
            }
            effectiveProperties = groupProperties[groupName];
            effectiveBucketingValue = groups[groupName];
          }
        }
        const matchResult = await this.isConditionMatch(flag, effectiveBucketingValue, condition, effectiveProperties, evaluationContext);
        if (matchResult === "match") {
          const variantOverride = condition.variant;
          const flagVariants = flagFilters.multivariate?.variants || [];
          result = variantOverride && flagVariants.some((variant) => variant.key === variantOverride) ? variantOverride : await this.getMatchingVariant(flag, effectiveBucketingValue) || true;
          break;
        }
        if (earlyExitEnabled && matchResult === "out_of_rollout_bound") {
          if (inconclusiveReason)
            break;
          return false;
        }
      } catch (e) {
        if (e instanceof RequiresServerEvaluation) {
          let definitionReason;
          try {
            definitionReason = getDefinitionUnresolvedReason(flag, evaluationContext.definitions);
          } catch {}
          const reason = pickUnresolvedReason(pickUnresolvedReason(inconclusiveReason, e.reason), definitionReason ?? e.reason);
          throw reason === e.reason ? e : new RequiresServerEvaluation(e.message, reason);
        }
        if (e instanceof InconclusiveMatchError) {
          inconclusiveReason = pickUnresolvedReason(inconclusiveReason, e.reason);
          if (Symbol.for("posthog.requiresServerRegexEvaluation") in e) {
            regexError = e;
            if (earlyExitEnabled && condition.rollout_percentage != null && await getFeatureFlagHash(flag.key, effectiveBucketingValue) > condition.rollout_percentage / 100)
              deferredRegexValues.add(false);
            else {
              const variants = flagFilters.multivariate?.variants || [];
              const override = condition.variant;
              deferredRegexValues.add(override && variants.some((variant) => variant.key === override) ? override : await this.getMatchingVariant(flag, effectiveBucketingValue) || true);
            }
          }
        } else
          throw e;
      }
    }
    if (result !== undefined && !(regexError && [
      ...deferredRegexValues
    ].some((value) => value !== result)))
      return result;
    if (inconclusiveReason)
      throw preserveRegexUncertainty(new InconclusiveMatchError("Can't determine if feature flag is enabled or not with given properties", inconclusiveReason), regexError);
    return false;
  }
  async isConditionMatch(flag, bucketingValue, condition, properties, evaluationContext) {
    evaluationContext = this.withEvaluationSnapshot(evaluationContext);
    const definitions = evaluationContext.definitions;
    const rolloutPercentage = condition.rollout_percentage;
    const warnFunction = (msg) => {
      this.logMsgIfDebug(() => console.warn(msg));
    };
    if ((condition.properties || []).length > 0) {
      let inconclusiveReason;
      let regexError;
      let serverEvaluationError;
      for (const prop of condition.properties) {
        const propertyType = prop.type;
        let matches = false;
        try {
          if (propertyType === "cohort") {
            const inCohort = await matchCohort(prop, properties, definitions.cohorts, this.debugMode, (depProp) => this.evaluateFlagDependency(depProp, properties, evaluationContext), definitions.propertyMatchingVersion);
            matches = prop.operator === "not_in" ? !inCohort : inCohort;
          } else if (propertyType === "flag")
            matches = await this.evaluateFlagDependency(prop, properties, evaluationContext);
          else if (Object.prototype.hasOwnProperty.call(properties, prop.key))
            matches = matchProperty(prop, properties, warnFunction, definitions.propertyMatchingVersion);
          else {
            assertFeatureFlagFilterSupported(prop);
            inconclusiveReason = pickUnresolvedReason(inconclusiveReason, "missing_context");
            continue;
          }
        } catch (e) {
          if (e instanceof RequiresServerEvaluation) {
            if (inconclusiveReason === undefined)
              serverEvaluationError ??= e;
            inconclusiveReason = pickUnresolvedReason(inconclusiveReason, e.reason);
            continue;
          }
          if (e instanceof InconclusiveMatchError) {
            if (Symbol.for("posthog.requiresServerRegexEvaluation") in e)
              regexError = e;
            inconclusiveReason = pickUnresolvedReason(inconclusiveReason, e.reason);
            continue;
          }
          if (inconclusiveReason !== undefined)
            break;
          throw e;
        }
        if (!matches)
          return "no_match";
      }
      if (serverEvaluationError)
        throw serverEvaluationError;
      if (inconclusiveReason)
        throw preserveRegexUncertainty(new InconclusiveMatchError(`Can't determine if a condition of flag ${flag.key} matches`, inconclusiveReason), regexError);
      if (rolloutPercentage == undefined)
        return "match";
    }
    if (rolloutPercentage != null && await getFeatureFlagHash(flag.key, bucketingValue) > rolloutPercentage / 100)
      return "out_of_rollout_bound";
    return "match";
  }
  async getMatchingVariant(flag, bucketingValue) {
    return getFeatureFlagVariant(flag.key, bucketingValue, flag.filters?.multivariate?.variants || []);
  }
  variantLookupTable(flag) {
    return getFeatureFlagVariantLookupTable(flag.filters?.multivariate?.variants || []);
  }
  filterFlagsByEvaluationContexts(flags) {
    if (!this.evaluationContexts || this.evaluationContexts.length === 0)
      return flags;
    const contexts = new Set(this.evaluationContexts);
    return flags.filter((flag) => {
      const tags = flag.evaluation_contexts ?? flag.evaluation_tags;
      if (!tags || tags.length === 0)
        return true;
      return tags.some((tag) => contexts.has(tag));
    });
  }
  getEvaluationRuntimeForFlag(key) {
    const flag = this.featureFlagsByKey[key];
    return flag ? normalizeEvaluationRuntime(flag.evaluation_runtime) : undefined;
  }
  getFlagKeysByEvaluationRuntime(runtime) {
    return this.featureFlags.filter((flag) => evaluationRuntimesMatch(normalizeEvaluationRuntime(flag.evaluation_runtime), runtime)).map((flag) => flag.key);
  }
  updateFlagState(flagData) {
    const flags = this.filterFlagsByEvaluationContexts(flagData.flags);
    const featureFlagsByKey = flags.reduce((acc, curr) => (acc[curr.key] = curr, acc), {});
    const keptKeys = new Set(flags.map((flag) => flag.key));
    const filteredOutFlagKeys = new Set(flagData.flags.filter((flag) => !keptKeys.has(flag.key)).map((flag) => flag.key));
    this.featureFlags = flags;
    this.featureFlagsByKey = featureFlagsByKey;
    this.filteredOutFlagKeys = filteredOutFlagKeys;
    this.groupTypeMapping = flagData.group_type_mapping ?? flagData.groupTypeMapping ?? {};
    this.cohorts = flagData.cohorts;
    this.propertyMatchingVersion = flagData.property_matching_version ?? flagData.propertyMatchingVersion;
    this.loadedSuccessfullyOnce = true;
    this.onMinimalFlagCalledEvents?.((flagData.minimal_flag_called_events ?? flagData.minimalFlagCalledEvents) === true);
  }
  warnAboutUnresolvableFlags(flags) {
    const experienceContinuityFlags = [];
    const unsupportedDefinitionFlags = [];
    const warnedFlags = new Map;
    const definitions = this.currentDefinitions();
    for (const flag of flags) {
      if (!evaluationRuntimesMatch(normalizeEvaluationRuntime(flag.evaluation_runtime), "server"))
        continue;
      const reason = getDefinitionUnresolvedReason(flag, definitions);
      if (!reason)
        continue;
      const fingerprint = JSON.stringify(flag);
      warnedFlags.set(flag.key, fingerprint);
      if (this.warnedUnresolvableFlags.get(flag.key) !== fingerprint)
        if (reason === "experience_continuity")
          experienceContinuityFlags.push(flag.key);
        else
          unsupportedDefinitionFlags.push(flag.key);
    }
    this.warnedUnresolvableFlags = warnedFlags;
    if (experienceContinuityFlags.length > 0) {
      const consequence = this.strictLocalEvaluation ? "With strictLocalEvaluation enabled these flags are left unresolved. To evaluate them locally, disable experience continuity on these flags in PostHog." : "Experience continuity is incompatible with local evaluation and will cause a server request on every flag evaluation, negating local evaluation cost savings. To avoid server requests and unexpected costs, either disable experience continuity on these flags in PostHog, use strictLocalEvaluation: true in client init, or pass onlyEvaluateLocally: true per flag call (flags that cannot be evaluated locally will return undefined).";
      console.warn(`[PostHog] You are using local evaluation but ${experienceContinuityFlags.length} flag(s) have experience continuity enabled and cannot be resolved locally (reason: experience_continuity): ${experienceContinuityFlags.join(", ")}. ` + consequence);
    }
    if (unsupportedDefinitionFlags.length > 0) {
      const consequence = this.strictLocalEvaluation ? "With strictLocalEvaluation enabled these flags are left unresolved when evaluation reaches that part." : "Evaluating these flags falls back to a server request when evaluation reaches that part.";
      console.warn(`[PostHog] You are using local evaluation but ${unsupportedDefinitionFlags.length} flag(s) use something local evaluation does not support, such as a static cohort, an unknown operator, or a missing or circular flag dependency (reason: unsupported_definition): ${unsupportedDefinitionFlags.join(", ")}. ${consequence} To evaluate them locally, change these flags in PostHog or upgrade posthog-node.`);
    }
  }
  async loadFromCache(debugMessage) {
    if (!this.cacheProvider)
      return false;
    try {
      const cached = await this.cacheProvider.getFlagDefinitions();
      if (cached) {
        this.updateFlagState(cached);
        this.logMsgIfDebug(() => console.debug(`[FEATURE FLAGS] ${debugMessage} (${cached.flags.length} flags)`));
        this.onLoad?.(this.featureFlags.length);
        this.warnAboutUnresolvableFlags(this.featureFlags);
        return true;
      }
      return false;
    } catch (err) {
      this.onError?.(new Error(`Failed to load from cache: ${err}`));
      return false;
    }
  }
  async loadFeatureFlags(forceReload = false) {
    if (this.loadedSuccessfullyOnce && !forceReload)
      return;
    if (!forceReload && this.nextFetchAllowedAt && Date.now() < this.nextFetchAllowedAt)
      return void this.logMsgIfDebug(() => console.debug("[FEATURE FLAGS] Skipping fetch, in backoff period"));
    if (!this.loadingPromise)
      this.loadingPromise = this._loadFeatureFlags().catch((err) => this.logMsgIfDebug(() => console.debug(`[FEATURE FLAGS] Failed to load feature flags: ${err}`))).finally(() => {
        this.loadingPromise = undefined;
      });
    return this.loadingPromise;
  }
  isLocalEvaluationReady() {
    return (this.loadedSuccessfullyOnce ?? false) && (this.featureFlags?.length ?? 0) > 0;
  }
  getFlagDefinitionsLoadedAt() {
    return this.flagDefinitionsLoadedAt;
  }
  getPollingInterval() {
    const interval = this.pollingInterval ?? 30000;
    if (!this.shouldBeginExponentialBackoff)
      return interval;
    return Math.min(SIXTY_SECONDS, interval * 2 ** this.backOffCount);
  }
  beginBackoff() {
    this.shouldBeginExponentialBackoff = true;
    this.backOffCount += 1;
    this.nextFetchAllowedAt = Date.now() + this.getPollingInterval();
  }
  clearBackoff() {
    this.shouldBeginExponentialBackoff = false;
    this.backOffCount = 0;
    this.nextFetchAllowedAt = undefined;
  }
  async _loadFeatureFlags() {
    if (this.poller) {
      clearTimeout(this.poller);
      this.poller = undefined;
    }
    try {
      if (this.cacheProvider && !this.personalApiKey)
        return void await this.loadFromCache("Loaded flags from cache (cache-only reader)");
      let shouldFetch = true;
      if (this.cacheProvider)
        try {
          shouldFetch = await this.cacheProvider.shouldFetchFlagDefinitions();
        } catch (err) {
          this.onError?.(new Error(`Error in shouldFetchFlagDefinitions: ${err}`));
        }
      if (!shouldFetch) {
        const loaded = await this.loadFromCache("Loaded flags from cache (skipped fetch)");
        if (loaded)
          return;
        if (this.loadedSuccessfullyOnce)
          return;
      }
      const res = await this._requestFeatureFlagDefinitions();
      if (!res)
        return;
      switch (res.status) {
        case 304:
          this.logMsgIfDebug(() => console.debug("[FEATURE FLAGS] Flags not modified (304), using cached data"));
          this.flagsEtag = res.headers?.get("ETag") ?? this.flagsEtag;
          this.loadedSuccessfullyOnce = true;
          this.clearBackoff();
          return;
        case 401:
          this.beginBackoff();
          throw new ClientError(`Your project key or secret key is invalid. Setting next polling interval to ${this.getPollingInterval()}ms. More information: https://posthog.com/docs/api#rate-limiting`);
        case 402:
          console.warn("[FEATURE FLAGS] Feature flags quota limit exceeded - unsetting all local flags. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts");
          this.featureFlags = [];
          this.featureFlagsByKey = {};
          this.filteredOutFlagKeys = new Set;
          this.groupTypeMapping = {};
          this.cohorts = {};
          this.propertyMatchingVersion = undefined;
          this.onMinimalFlagCalledEvents?.(false);
          return;
        case 403:
          this.beginBackoff();
          throw new ClientError(`Your secret key does not have permission to fetch feature flag definitions for local evaluation. Setting next polling interval to ${this.getPollingInterval()}ms. Are you sure you're using the correct secret and Project API key pair? More information: https://posthog.com/docs/api/overview`);
        case 429:
          this.beginBackoff();
          throw new ClientError(`You are being rate limited. Setting next polling interval to ${this.getPollingInterval()}ms. More information: https://posthog.com/docs/api#rate-limiting`);
        case 200: {
          const responseJson = await res.json() ?? {};
          if (!("flags" in responseJson))
            return void this.onError?.(new Error(`Invalid response when getting feature flags: ${JSON.stringify(responseJson)}`));
          this.flagsEtag = res.headers?.get("ETag") ?? undefined;
          const groupTypeMapping = responseJson.group_type_mapping || {};
          const minimalFlagCalledEvents = responseJson.minimal_flag_called_events === true;
          const flagData = {
            flags: responseJson.flags ?? [],
            group_type_mapping: groupTypeMapping,
            cohorts: responseJson.cohorts || {},
            minimal_flag_called_events: minimalFlagCalledEvents,
            property_matching_version: responseJson.property_matching_version,
            propertyMatchingVersion: responseJson.property_matching_version,
            groupTypeMapping,
            minimalFlagCalledEvents
          };
          this.updateFlagState(flagData);
          this.flagDefinitionsLoadedAt = Date.now();
          this.clearBackoff();
          if (this.cacheProvider && shouldFetch)
            try {
              await this.cacheProvider.onFlagDefinitionsReceived(flagData);
            } catch (err) {
              this.onError?.(new Error(`Failed to store in cache: ${err}`));
            }
          this.onLoad?.(this.featureFlags.length);
          this.warnAboutUnresolvableFlags(this.featureFlags);
          break;
        }
        default:
          return;
      }
    } catch (err) {
      if (err instanceof ClientError)
        this.onError?.(err);
    } finally {
      if (!this.pollerStopped && this.pollingInterval !== null)
        this.poller = setTimeout(() => this.loadFeatureFlags(true), this.getPollingInterval());
    }
  }
  getPersonalApiKeyRequestOptions(method = "GET", etag) {
    const headers = {
      ...this.customHeaders,
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.personalApiKey}`
    };
    if (etag)
      headers["If-None-Match"] = etag;
    return {
      method,
      headers
    };
  }
  async _requestFeatureFlagDefinitions() {
    if (!this.personalApiKey)
      throw new ClientError("A secretKey or personalApiKey is required to fetch feature flag definitions from PostHog.");
    const url = `${this.host}/flags/definitions?token=${this.projectApiKey}&send_cohorts`;
    const options = this.getPersonalApiKeyRequestOptions("GET", this.flagsEtag);
    let abortTimeout = null;
    if (this.timeout && typeof this.timeout == "number") {
      const controller = new AbortController;
      abortTimeout = safeSetTimeout(() => {
        controller.abort();
      }, this.timeout);
      options.signal = controller.signal;
    }
    const clearAbortTimeout = () => clearTimeout(abortTimeout);
    try {
      const fetch1 = this.fetch;
      const res = await fetch1(url, options);
      if (res.status !== 200) {
        clearAbortTimeout();
        return res;
      }
      return {
        status: res.status,
        headers: res.headers,
        body: res.body,
        text: async () => {
          try {
            return await res.text();
          } finally {
            clearAbortTimeout();
          }
        },
        json: async () => {
          try {
            return await res.json();
          } finally {
            clearAbortTimeout();
          }
        }
      };
    } catch (err) {
      clearAbortTimeout();
      throw err;
    }
  }
  async stopPoller(timeoutMs = 30000) {
    this.pollerStopped = true;
    clearTimeout(this.poller);
    this.poller = undefined;
    if (this.cacheProvider)
      try {
        const shutdownResult = this.cacheProvider.shutdown();
        if (shutdownResult instanceof Promise)
          await raceWithTimeout(shutdownResult, timeoutMs, () => {
            throw new Error(`Cache shutdown timeout after ${timeoutMs}ms`);
          });
      } catch (err) {
        this.onError?.(new Error(`Error during cache shutdown: ${err}`));
      }
  }
}
function getDefinitionUnresolvedReason(flag, definitions) {
  if (!flag.active)
    return;
  if (flag.ensure_experience_continuity)
    return "experience_continuity";
  const flagFilters = flag.filters || {};
  const aggregation = flagFilters.aggregation_group_type_index;
  if (aggregation != null && !definitions.groupTypeMapping[String(aggregation)])
    return "unsupported_definition";
  const usesUnsupportedProperty = (flagFilters.groups || []).some((condition) => (condition.properties || []).some((property) => isUnsupportedProperty(property, definitions, new Set)));
  return usesUnsupportedProperty ? "unsupported_definition" : undefined;
}
function isUnsupportedProperty(property, definitions, visitedCohortIds) {
  if (property.type === "flag") {
    const dependencyChain = property.dependency_chain;
    if (!Array.isArray(dependencyChain) || dependencyChain.length === 0)
      return true;
    return dependencyChain.some((key) => !definitions.featureFlagsByKey[key] && !definitions.filteredOutFlagKeys.has(key));
  }
  if (property.type !== "cohort")
    try {
      assertFeatureFlagFilterSupported(property);
      return false;
    } catch (e) {
      if (e instanceof InconclusiveMatchError)
        return true;
      throw e;
    }
  const cohortId = String(property.value);
  if (!(cohortId in definitions.cohorts))
    return true;
  if (visitedCohortIds.has(cohortId))
    return false;
  visitedCohortIds.add(cohortId);
  return isUnsupportedPropertyGroup(definitions.cohorts[cohortId], definitions, visitedCohortIds);
}
function isUnsupportedPropertyGroup(group, definitions, visitedCohortIds) {
  return (group?.values ?? []).some((value) => ("values" in value) ? isUnsupportedPropertyGroup(value, definitions, visitedCohortIds) : isUnsupportedProperty(value, definitions, visitedCohortIds));
}
function matchProperty(property, propertyValues, warnFunction, propertyMatchingVersion) {
  return matchFeatureFlagProperty(property, propertyValues, {
    warnFunction,
    propertyMatchingVersion
  });
}
function checkCohortExists(cohortId, cohortProperties) {
  if (!(cohortId in cohortProperties))
    throw new RequiresServerEvaluation(`cohort ${cohortId} not found in local cohorts - likely a static cohort that requires server evaluation`);
}
async function matchCohort(property, propertyValues, cohortProperties, debugMode = false, flagDependencyEvaluator, propertyMatchingVersion) {
  const cohortId = String(property.value);
  checkCohortExists(cohortId, cohortProperties);
  const propertyGroup = cohortProperties[cohortId];
  return matchPropertyGroup(propertyGroup, propertyValues, cohortProperties, debugMode, flagDependencyEvaluator, propertyMatchingVersion);
}
async function matchPropertyGroup(propertyGroup, propertyValues, cohortProperties, debugMode = false, flagDependencyEvaluator, propertyMatchingVersion) {
  if (!propertyGroup)
    return true;
  const propertyGroupType = propertyGroup.type;
  const properties = propertyGroup.values;
  if (!properties || properties.length === 0)
    return true;
  let inconclusiveReason;
  let regexError;
  if ("values" in properties[0]) {
    for (const prop of properties)
      try {
        const matches = await matchPropertyGroup(prop, propertyValues, cohortProperties, debugMode, flagDependencyEvaluator, propertyMatchingVersion);
        if (propertyGroupType === "AND") {
          if (!matches)
            return false;
        } else if (matches)
          return true;
      } catch (err) {
        if (err instanceof RequiresServerEvaluation)
          throw err;
        if (err instanceof InconclusiveMatchError) {
          if (debugMode)
            console.debug(`Failed to compute property ${prop} locally: ${err}`);
          inconclusiveReason = pickUnresolvedReason(inconclusiveReason, err.reason);
          if (Symbol.for("posthog.requiresServerRegexEvaluation") in err)
            regexError = err;
        } else
          throw err;
      }
    if (inconclusiveReason)
      throw preserveRegexUncertainty(new InconclusiveMatchError("Can't match cohort without a given cohort property value", inconclusiveReason), regexError);
    return propertyGroupType === "AND";
  }
  for (const prop of properties)
    try {
      let matches;
      if (prop.type === "cohort")
        matches = await matchCohort(prop, propertyValues, cohortProperties, debugMode, flagDependencyEvaluator, propertyMatchingVersion);
      else if (prop.type === "flag") {
        if (!flagDependencyEvaluator)
          throw new InconclusiveMatchError(`Flag dependency '${prop.key || "unknown"}' cannot be evaluated without a flag dependency evaluator`);
        matches = await flagDependencyEvaluator(prop);
      } else
        matches = matchProperty(prop, propertyValues, undefined, propertyMatchingVersion);
      const negation = prop.negation || false;
      if (propertyGroupType === "AND") {
        if (!matches && !negation)
          return false;
        if (matches && negation)
          return false;
      } else {
        if (matches && !negation)
          return true;
        if (!matches && negation)
          return true;
      }
    } catch (err) {
      if (err instanceof RequiresServerEvaluation)
        throw err;
      if (err instanceof InconclusiveMatchError) {
        if (debugMode)
          console.debug(`Failed to compute property ${prop} locally: ${err}`);
        inconclusiveReason = pickUnresolvedReason(inconclusiveReason, err.reason);
        if (Symbol.for("posthog.requiresServerRegexEvaluation") in err)
          regexError = err;
      } else
        throw err;
    }
  if (inconclusiveReason)
    throw preserveRegexUncertainty(new InconclusiveMatchError("can't match cohort without a given cohort property value", inconclusiveReason), regexError);
  return propertyGroupType === "AND";
}
var SIXTY_SECONDS = 60000, ClientError, RequiresServerEvaluation, UNRESOLVED_REASON_PRECEDENCE;
var init_feature_flags = __esm(() => {
  init_dist();
  ClientError = class ClientError extends Error {
    constructor(message) {
      super();
      Error.captureStackTrace(this, this.constructor);
      this.name = "ClientError";
      this.message = message;
      Object.setPrototypeOf(this, ClientError.prototype);
    }
  };
  RequiresServerEvaluation = class RequiresServerEvaluation extends Error {
    constructor(message, reason = "unsupported_definition") {
      super(message), this.reason = reason;
      setCustomErrorPrototype(this, RequiresServerEvaluation);
    }
  };
  UNRESOLVED_REASON_PRECEDENCE = [
    "experience_continuity",
    "unsupported_definition",
    "unresolved_dependency",
    "missing_context"
  ];
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/error-tracking/autocapture.mjs
function splitNodeOptions(nodeOptions) {
  const args = [];
  let current = "";
  let isInString = false;
  for (let index = 0;index < nodeOptions.length; index++) {
    const character = nodeOptions[index];
    if (character === "\\" && isInString && index + 1 < nodeOptions.length)
      current += nodeOptions[++index];
    else if (character !== " " || isInString)
      if (character === '"')
        isInString = !isInString;
      else
        current += character;
    else if (current) {
      args.push(current);
      current = "";
    }
  }
  if (current)
    args.push(current);
  return args;
}
function findUnhandledRejectionMode(args) {
  let mode;
  for (let index = 0;index < args.length; index++) {
    const argument = args[index];
    const optionName = UNHANDLED_REJECTION_OPTION_NAMES.find((name) => argument === name || argument.startsWith(`${name}=`));
    if (!optionName)
      continue;
    const value = argument === optionName ? args[++index] : argument.slice(optionName.length + 1);
    if (UNHANDLED_REJECTION_MODES.has(value))
      mode = value;
  }
  return mode;
}
function getUnhandledRejectionMode(execArgv = STARTUP_EXEC_ARGV, nodeOptions = STARTUP_NODE_OPTIONS) {
  return findUnhandledRejectionMode(execArgv) ?? findUnhandledRejectionMode(splitNodeOptions(nodeOptions ?? "")) ?? "throw";
}
function snapshotAsyncContext() {
  try {
    const process2 = globalThis.process;
    const asyncHooks = process2?.getBuiltinModule?.("node:async_hooks");
    const snapshot = asyncHooks?.AsyncLocalStorage?.snapshot?.();
    if (snapshot)
      return snapshot;
  } catch {}
  return (run) => run();
}
function isPostHogListener(listener) {
  return typeof listener == "function" && listener._posthogErrorHandler === true;
}
function isWeakKey(value) {
  return typeof value == "object" && value !== null || typeof value == "function";
}
function markListener(listener) {
  return Object.assign(listener, {
    _posthogErrorHandler: true
  });
}
function hasHostUnhandledRejectionListener(process2) {
  return process2.listeners("unhandledRejection").some((listener) => !isPostHogListener(listener));
}
function isFrameworkControlFlow(reason, depth = 0) {
  try {
    if (!isWeakKey(reason))
      return false;
    const candidate = reason;
    if (candidate.$$typeof === REACT_POSTPONE)
      return true;
    if (typeof candidate.digest == "string" && CONTROL_FLOW_DIGESTS.has(candidate.digest))
      return true;
    return depth < 5 && isFrameworkControlFlow(candidate.cause, depth + 1);
  } catch {
    return false;
  }
}
function isAbortError(reason) {
  try {
    return isWeakKey(reason) && reason.name === "AbortError";
  } catch {
    return false;
  }
}
function isIgnored(exception, origin) {
  return isFrameworkControlFlow(exception) || origin === "unhandledRejection" && isAbortError(exception);
}
function captureTargets(state) {
  const targets = new Map;
  for (const client of state.clients) {
    const chosen = targets.get(client.key);
    if (!chosen || chosen.getContext() === undefined && client.getContext() !== undefined)
      targets.set(client.key, client);
  }
  for (const [key, client] of state.retired)
    if (!targets.has(key))
      targets.set(key, client);
  return [
    ...targets.values()
  ];
}
function nextTurn(callback) {
  if (typeof globalThis.setImmediate == "function")
    setImmediate(callback);
  else
    setTimeout(callback, 0);
}
function scheduleTurnReset(state) {
  if (state.turnResetScheduled)
    return;
  state.turnResetScheduled = true;
  nextTurn(() => {
    nextTurn(() => {
      state.capturedThisTurn.clear();
      state.turnResetScheduled = false;
    });
  });
}
function recordCapture(state, exception, key, source) {
  const captured = state.capturedThisTurn.get(exception) ?? new Map;
  if (!captured.has(key))
    captured.set(key, source);
  state.capturedThisTurn.set(exception, captured);
  scheduleTurnReset(state);
}
function wasCapturedThisTurn(state, exception) {
  const captured = state.capturedThisTurn.get(exception);
  return captured !== undefined && captureTargets(state).every((client) => captured.has(client.key));
}
function dispatch(state, exception, hint, skipKeys) {
  const captured = state.capturedThisTurn.get(exception);
  const owners = [];
  for (const client of captureTargets(state))
    if (!(captured?.has(client.key) || skipKeys?.has(client.key))) {
      recordCapture(state, exception, client.key, "autocapture");
      client.capture(exception, hint);
      owners.push(client);
    }
  return owners;
}
function captureDeferred(state, deferred) {
  if (state.deferred.get(deferred.exception) !== deferred)
    return [];
  state.deferred.delete(deferred.exception);
  return deferred.runInContext(() => dispatch(state, deferred.exception, deferred.hint, deferred.skipKeys));
}
function deferCapture(state, exception, hint) {
  if (wasCapturedThisTurn(state, exception) || state.deferred.has(exception))
    return;
  const deferred = {
    exception,
    hint,
    skipKeys: new Set(state.capturedThisTurn.get(exception)?.keys()),
    runInContext: snapshotAsyncContext()
  };
  state.deferred.set(exception, deferred);
  nextTurn(() => captureDeferred(state, deferred));
}
async function exitAfterFatalError(state, error) {
  try {
    console.error(error);
  } catch {}
  capturePendingExceptions();
  const clients = new Set([
    ...state.clients,
    ...state.retired.values()
  ]);
  await Promise.all([
    ...clients
  ].map((client) => client.shutdown().catch(() => {
    return;
  })));
  globalThis.process.exit(1);
}
function captureUncaughtException(state, error, origin, fatal) {
  const hint = origin === "unhandledRejection" ? UNHANDLED_REJECTION_HINT : UNCAUGHT_EXCEPTION_HINT;
  if (!fatal) {
    if (!isIgnored(error, origin))
      deferCapture(state, error, hint);
    return;
  }
  const deferred = state.deferred.get(error);
  if (deferred)
    captureDeferred(state, deferred);
  else
    dispatch(state, error, hint);
}
function makeUncaughtExceptionHandler(state) {
  return markListener((error, origin) => {
    const process2 = globalThis.process;
    const userProvidedListenersCount = process2.listeners("uncaughtException").filter((listener) => listener.name !== "domainUncaughtExceptionClear" && !isPostHogListener(listener)).length;
    const fatal = userProvidedListenersCount === 0;
    captureUncaughtException(state, error, origin, fatal);
    if (fatal && !state.calledFatalError) {
      state.calledFatalError = true;
      exitAfterFatalError(state, error);
    }
  });
}
function describeReason(reason) {
  try {
    return String(reason);
  } catch {
    return typeof reason;
  }
}
function toUnhandledRejectionError(reason) {
  if (reason instanceof Error)
    return reason;
  const error = new Error(`This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). The promise rejected with the reason "${describeReason(reason)}".`);
  return Object.assign(error, {
    name: "UnhandledPromiseRejection",
    code: "ERR_UNHANDLED_REJECTION"
  });
}
function applyDefaultRejectionHandling(state, reason) {
  const process2 = globalThis.process;
  if (state.mode === "warn-with-error-code") {
    process2.emitWarning(`Unhandled promise rejection: ${describeReason(reason)}`, "UnhandledPromiseRejectionWarning");
    process2.exitCode = 1;
    if (!isIgnored(reason, "unhandledRejection"))
      dispatch(state, reason, UNHANDLED_REJECTION_HINT);
    return;
  }
  if (process2.versions?.bun) {
    process2.exitCode = 1;
    dispatch(state, reason, UNHANDLED_REJECTION_HINT);
    if (!state.calledFatalError) {
      state.calledFatalError = true;
      exitAfterFatalError(state, reason);
    }
    return;
  }
  const escalated = toUnhandledRejectionError(reason);
  const emit = process2.emit;
  emit.call(process2, "uncaughtExceptionMonitor", escalated, "unhandledRejection");
  emit.call(process2, "uncaughtException", escalated, "unhandledRejection");
}
function makeUnhandledRejectionHandler(state, replacesDefaultHandling, isInstalled) {
  return markListener((reason) => {
    if (replacesDefaultHandling && !hasHostUnhandledRejectionListener(globalThis.process) && isInstalled())
      return void applyDefaultRejectionHandling(state, reason);
    if (!isIgnored(reason, "unhandledRejection"))
      deferCapture(state, reason, UNHANDLED_REJECTION_HINT);
  });
}
function joinHostRejectionQueue(listener) {
  const process2 = globalThis.process;
  if (!posthogGlobal[NEXT_REJECTION_FILTER] || typeof process2.rawListeners != "function")
    return;
  if (!process2.rawListeners("unhandledRejection").includes(listener))
    return;
  const removeListener = Object.getPrototypeOf(process2).removeListener;
  removeListener.call(process2, "unhandledRejection", listener);
  if (!process2.listeners("unhandledRejection").includes(listener))
    process2.prependListener("unhandledRejection", listener);
}
function installListeners(state) {
  const process2 = globalThis.process;
  const removals = [];
  const listen = (event, listener) => {
    process2.on(event, listener);
    removals.push(() => process2.removeListener(event, listener));
  };
  const remove = () => removals.forEach((removal) => removal());
  if (state.mode === "strict") {
    const monitor = (error, origin) => captureUncaughtException(state, error, origin, true);
    listen("uncaughtExceptionMonitor", monitor);
    return {
      remove,
      areInstalled: () => process2.listeners("uncaughtExceptionMonitor").includes(monitor)
    };
  }
  const uncaughtExceptionHandler = makeUncaughtExceptionHandler(state);
  listen("uncaughtException", uncaughtExceptionHandler);
  const replacesDefaultHandling = state.mode === "throw" || state.mode === "warn-with-error-code";
  const followsHostListeners = replacesDefaultHandling && !process2.versions?.bun;
  const isInstalled = () => process2.listeners("unhandledRejection").includes(listener);
  const listener = makeUnhandledRejectionHandler(state, replacesDefaultHandling, isInstalled);
  const keepFirst = () => {
    const raw = typeof process2.rawListeners == "function" ? process2.rawListeners("unhandledRejection") : [];
    if (raw.includes(listener) && raw[0] !== listener) {
      process2.removeListener("unhandledRejection", listener);
      process2.prependListener("unhandledRejection", listener);
    }
  };
  listen("newListener", markListener((event, added) => {
    if (isPostHogListener(added))
      return;
    if (event === "unhandledRejection") {
      if (!isInstalled())
        process2.prependListener("unhandledRejection", listener);
      queueMicrotask(() => {
        keepFirst();
        joinHostRejectionQueue(listener);
      });
    } else if (event === NEXT_LISTENER_EVENT)
      queueMicrotask(() => {
        if (!isInstalled())
          process2.prependListener("unhandledRejection", listener);
      });
  }));
  if (followsHostListeners) {
    listen("removeListener", markListener((event) => {
      if (event === "unhandledRejection" && isInstalled() && !hasHostUnhandledRejectionListener(process2))
        process2.removeListener("unhandledRejection", listener);
    }));
    if (hasHostUnhandledRejectionListener(process2))
      process2.prependListener("unhandledRejection", listener);
  } else
    process2.prependListener("unhandledRejection", listener);
  joinHostRejectionQueue(listener);
  removals.push(() => {
    process2.removeListener("unhandledRejection", listener);
    if (typeof process2.rawListeners == "function" && process2.rawListeners("unhandledRejection").includes(listener)) {
      const removeListener = Object.getPrototypeOf(process2).removeListener;
      removeListener.call(process2, "unhandledRejection", listener);
    }
  });
  return {
    remove,
    areInstalled: () => process2.listeners("uncaughtException").includes(uncaughtExceptionHandler) && (followsHostListeners || isInstalled())
  };
}
function startExceptionAutocapture(client, mode = STARTUP_UNHANDLED_REJECTION_MODE) {
  if (!globalThis.process?.on)
    return () => {
      return;
    };
  let state = posthogGlobal[STATE_KEY];
  if (state) {
    if (!state.listeners.areInstalled()) {
      state.listeners.remove();
      state.listeners = installListeners(state);
    }
  } else {
    const created = {
      mode,
      clients: new Set,
      retired: new Map,
      capturedThisTurn: new Map,
      deferred: new Map,
      turnResetScheduled: false,
      calledFatalError: false,
      listeners: {
        remove: () => {
          return;
        },
        areInstalled: () => true
      }
    };
    created.listeners = installListeners(created);
    posthogGlobal[STATE_KEY] = created;
    state = created;
  }
  state.clients.add(client);
  state.retired.delete(client.key);
  const activeState = state;
  return () => {
    if (!activeState.clients.delete(client))
      return;
    if (![
      ...activeState.clients
    ].some((other) => other.key === client.key))
      activeState.retired.set(client.key, client);
  };
}
function claimExplicitCapture(error, key) {
  const state = posthogGlobal[STATE_KEY];
  if (!state)
    return true;
  if (state.capturedThisTurn.get(error)?.get(key) === "autocapture")
    return false;
  recordCapture(state, error, key, "app");
  state.deferred.get(error)?.skipKeys.add(key);
  return true;
}
function capturePendingExceptions() {
  const owners = new Set;
  const state = posthogGlobal[STATE_KEY];
  if (state)
    for (const deferred of [
      ...state.deferred.values()
    ])
      captureDeferred(state, deferred).forEach((owner) => owners.add(owner));
  return owners;
}
var UNHANDLED_REJECTION_OPTION_NAMES, UNHANDLED_REJECTION_MODES, STARTUP_EXEC_ARGV, STARTUP_NODE_OPTIONS, STARTUP_UNHANDLED_REJECTION_MODE, UNHANDLED_REJECTION_HINT, UNCAUGHT_EXCEPTION_HINT, CONTROL_FLOW_DIGESTS, REACT_POSTPONE, NEXT_REJECTION_FILTER, NEXT_LISTENER_EVENT = "Next.UnhandledRejectionFilter.MacguffinEvent", STATE_KEY, posthogGlobal;
var init_autocapture = __esm(() => {
  UNHANDLED_REJECTION_OPTION_NAMES = [
    "--unhandled-rejections",
    "--unhandled_rejections"
  ];
  UNHANDLED_REJECTION_MODES = new Set([
    "throw",
    "strict",
    "warn",
    "warn-with-error-code",
    "none"
  ]);
  STARTUP_EXEC_ARGV = [
    ...globalThis.process?.execArgv ?? []
  ];
  STARTUP_NODE_OPTIONS = globalThis.process?.env?.NODE_OPTIONS;
  STARTUP_UNHANDLED_REJECTION_MODE = getUnhandledRejectionMode();
  UNHANDLED_REJECTION_HINT = {
    mechanism: {
      type: "onunhandledrejection",
      handled: false
    }
  };
  UNCAUGHT_EXCEPTION_HINT = {
    mechanism: {
      type: "onuncaughtexception",
      handled: false
    }
  };
  CONTROL_FLOW_DIGESTS = new Set([
    "HANGING_PROMISE_REJECTION",
    "NEXT_PRERENDER_INTERRUPTED",
    "DYNAMIC_SERVER_USAGE",
    "BAILOUT_TO_CLIENT_SIDE_RENDERING"
  ]);
  REACT_POSTPONE = Symbol.for("react.postpone");
  NEXT_REJECTION_FILTER = Symbol.for("next.unhandledRejectionFilter");
  STATE_KEY = Symbol.for("posthog-node.exception-autocapture.v1");
  posthogGlobal = globalThis;
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/context/event-context.mjs
function snapshotEventContext(context) {
  const snapshot = context ? {
    ...context,
    properties: {
      ...context.properties
    }
  } : null;
  return (event) => Object.assign(event, {
    [capturedContext]: snapshot
  });
}
function getEventContext(event, fallback) {
  return capturedContext in event ? event[capturedContext] ?? undefined : fallback;
}
var capturedContext;
var init_event_context = __esm(() => {
  capturedContext = Symbol("capturedContext");
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/error-tracking/index.mjs
class error_tracking_ErrorTracking {
  constructor(client, options, _logger) {
    this.client = client;
    this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false;
    this._logger = _logger;
    this._rateLimiter = new BucketedRateLimiter({
      ...resolveExceptionRateLimiterConfig(options),
      refillInterval: 1e4,
      _logger: this._logger
    });
    this.startAutocaptureIfEnabled();
  }
  static isPreviouslyCapturedError(x) {
    return isObject2(x) && "__posthog_previously_captured_error" in x && x.__posthog_previously_captured_error === true;
  }
  static async buildEventMessage(builder, error, hint, distinctId, additionalProperties, context) {
    const applyContextSnapshot = snapshotEventContext(context);
    const properties = {
      ...additionalProperties
    };
    const exceptionProperties = builder.buildFromUnknown(error, hint);
    exceptionProperties.$exception_list = await builder.modifyFrames(exceptionProperties.$exception_list);
    const injectedReleaseId = getInjectedReleaseId();
    if (injectedReleaseId)
      properties.$release_id = injectedReleaseId;
    return applyContextSnapshot({
      event: "$exception",
      distinctId,
      properties: {
        ...exceptionProperties,
        ...properties
      },
      _originatedFromCaptureException: true
    });
  }
  get destinationKey() {
    return `${this.client.apiKey}@${this.client.host}`;
  }
  startAutocaptureIfEnabled() {
    if (this.isEnabled()) {
      this._autocaptureClient = {
        key: this.destinationKey,
        capture: (exception, hint) => this.onException(exception, hint),
        getContext: () => this.client.getContext(),
        flush: () => this.client.flush(),
        shutdown: () => this.client.shutdown(SHUTDOWN_TIMEOUT)
      };
      this._stopAutocapture = startExceptionAutocapture(this._autocaptureClient);
    }
  }
  claimExplicitCapture(error) {
    return claimExplicitCapture(error, this.destinationKey);
  }
  capturePendingExceptions() {
    for (const owner of capturePendingExceptions())
      if (owner !== this._autocaptureClient)
        this.client.addPendingPromise(owner.flush().catch(() => {
          return;
        }));
  }
  onException(exception, hint) {
    this.client.addPendingPromise((async () => {
      if (!error_tracking_ErrorTracking.isPreviouslyCapturedError(exception)) {
        const eventMessage = await error_tracking_ErrorTracking.buildEventMessage(this.client.getErrorPropertiesBuilder(), exception, hint, undefined, undefined, this.client.getContext());
        const exceptionProperties = eventMessage.properties;
        const exceptionType = exceptionProperties?.$exception_list[0]?.type ?? "Exception";
        const isRateLimited = this._rateLimiter.consumeRateLimit(exceptionType);
        if (isRateLimited)
          return void this._logger.info("Skipping exception capture because of client rate limiting.", {
            exception: exceptionType
          });
        return this.client._capturePreparedEvent(eventMessage, false);
      }
    })().catch((error) => {
      this._logger.error("Failed to capture an exception:", error);
    }));
  }
  isEnabled() {
    return !this.client.isDisabled && this._exceptionAutocaptureEnabled;
  }
  shutdown() {
    this._rateLimiter.stop();
    this.capturePendingExceptions();
    this._stopAutocapture?.();
    this._stopAutocapture = undefined;
  }
}
var SHUTDOWN_TIMEOUT = 2000, error_tracking_default;
var init_error_tracking2 = __esm(() => {
  init_autocapture();
  init_event_context();
  init_dist();
  error_tracking_default = error_tracking_ErrorTracking;
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/error-tracking/trace-context.mjs
async function getActiveTraceProperties() {
  try {
    const otelApi = globalThis[OTEL_API_GLOBAL_KEY];
    const span = otelApi?.context?.active().getValue(SPAN_CONTEXT_KEY);
    const spanContext = span?.spanContext();
    const traceId = spanContext?.traceId;
    const spanId = spanContext?.spanId;
    if (typeof traceId == "string" && typeof spanId == "string" && TRACE_ID_PATTERN.test(traceId) && SPAN_ID_PATTERN.test(spanId) && !/^0+$/.test(traceId) && !/^0+$/.test(spanId))
      return {
        $trace_id: traceId.toLowerCase(),
        $span_id: spanId.toLowerCase()
      };
  } catch {}
  return {};
}
var TRACE_ID_PATTERN, SPAN_ID_PATTERN, OTEL_API_GLOBAL_KEY, SPAN_CONTEXT_KEY;
var init_trace_context = __esm(() => {
  TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;
  SPAN_ID_PATTERN = /^[0-9a-f]{16}$/i;
  OTEL_API_GLOBAL_KEY = Symbol.for("opentelemetry.js.api.1");
  SPAN_CONTEXT_KEY = Symbol.for("OpenTelemetry Context Key SPAN");
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/storage-memory.mjs
class PostHogMemoryStorage {
  getProperty(key) {
    return this._memoryStorage[key];
  }
  setProperty(key, value) {
    this._memoryStorage[key] = value !== null ? value : undefined;
  }
  constructor() {
    this._memoryStorage = {};
  }
}
var init_storage_memory = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/context/listeners.mjs
function notifyContextListeners(client, requestEntry = false) {
  for (const listener of listeners.get(client) ?? [])
    try {
      listener(requestEntry);
    } catch {}
}
var REGISTRY_KEY, registryHolder, listeners;
var init_listeners = __esm(() => {
  REGISTRY_KEY = Symbol.for("posthog-node.context-listeners");
  registryHolder = globalThis;
  listeners = registryHolder[REGISTRY_KEY] ??= new WeakMap;
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/capture-v1/config.mjs
function isCaptureMode(value) {
  return value === "v0" || value === "v1";
}
function resolveCaptureMode() {
  const envMode = "u" > typeof process ? process.env?.POSTHOG_CAPTURE_MODE : undefined;
  return isCaptureMode(envMode) ? envMode : "v0";
}
var init_config3 = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/capture-v1/routing.mjs
function isLegacyOnlyEvent(message) {
  return typeof message.event == "string" && message.event.startsWith(AI_EVENT_PREFIX);
}
var AI_EVENT_PREFIX = "$ai_", ANALYTICS_ROUTE = "analytics", AI_ROUTE = "ai";
var init_routing = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/capture-v1/errors.mjs
var CaptureV1Error;
var init_errors3 = __esm(() => {
  CaptureV1Error = class CaptureV1Error extends Error {
    constructor({ requestId, drops, retryExhausted, cause }) {
      super(CaptureV1Error.buildMessage(requestId, drops, retryExhausted, cause)), this.name = "CaptureV1Error";
      this.requestId = requestId;
      this.drops = drops;
      this.retryExhausted = retryExhausted;
      this.cause = cause;
    }
    static buildMessage(requestId, drops, retryExhausted, cause) {
      let message = `Capture V1 batch ${requestId} did not fully deliver: ${drops.length} dropped, ${retryExhausted.length} undelivered`;
      if (cause instanceof Error)
        message += ` (${cause.message})`;
      return message;
    }
  };
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/capture-v1/transform.mjs
function coerceBool(value) {
  if (typeof value == "boolean")
    return value;
  if (typeof value == "number")
    return value !== 0;
  if (typeof value == "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1")
      return true;
    if (normalized === "false" || normalized === "0")
      return false;
  }
}
function coerceString(value) {
  return typeof value == "string" ? value : undefined;
}
function isRecord(value) {
  return typeof value == "object" && value !== null && !Array.isArray(value);
}
function toRfc3339(timestamp) {
  if (typeof timestamp == "string") {
    const asDate = new Date(timestamp);
    if (Number.isNaN(asDate.getTime()))
      return new Date().toISOString();
    const normalized = asDate.toISOString();
    const fractionalSeconds = timestamp.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})?$/i)?.[1];
    return fractionalSeconds && fractionalSeconds.length > 3 ? normalized.replace(/\.\d{3}Z$/, `.${fractionalSeconds}Z`) : normalized;
  }
  if (timestamp instanceof Date)
    return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
  const asDate = timestamp == null ? new Date : new Date(timestamp);
  return Number.isNaN(asDate.getTime()) ? new Date().toISOString() : asDate.toISOString();
}
function relocateInto(properties, key, value) {
  if (value !== undefined && !(key in properties))
    properties[key] = value;
}
function buildV1Event(message) {
  const sourceProperties = isRecord(message.properties) ? message.properties : {};
  const properties = {
    ...sourceProperties
  };
  const options = {};
  for (const { property, optionKey, coerce } of OPTION_SENTINELS)
    if (property in properties) {
      const coerced = coerce(properties[property]);
      if (coerced !== undefined)
        options[optionKey] = coerced;
      delete properties[property];
    }
  const topLevel = {};
  for (const { property, field } of TOPLEVEL_SENTINELS)
    if (property in properties) {
      const value = properties[property];
      if (typeof value == "string")
        topLevel[field] = value;
      delete properties[property];
    }
  delete properties.$lib;
  delete properties.$lib_version;
  relocateInto(properties, "$set", message.$set);
  relocateInto(properties, "$set_once", message.$set_once);
  return {
    event: String(message.event ?? ""),
    uuid: String(message.uuid ?? ""),
    distinct_id: String(message.distinct_id ?? ""),
    timestamp: toRfc3339(message.timestamp),
    ...topLevel,
    options,
    properties
  };
}
function buildV1Batch(messages, { createdAt, historicalMigration }) {
  const batch = {
    created_at: createdAt,
    batch: messages.map(buildV1Event)
  };
  if (historicalMigration)
    batch.historical_migration = true;
  return batch;
}
var OPTION_SENTINELS, TOPLEVEL_SENTINELS;
var init_transform = __esm(() => {
  OPTION_SENTINELS = [
    {
      property: "$cookieless_mode",
      optionKey: "cookieless_mode",
      coerce: coerceBool
    },
    {
      property: "$ignore_sent_at",
      optionKey: "disable_skew_correction",
      coerce: coerceBool
    },
    {
      property: "$process_person_profile",
      optionKey: "process_person_profile",
      coerce: coerceBool
    },
    {
      property: "$product_tour_id",
      optionKey: "product_tour_id",
      coerce: coerceString
    }
  ];
  TOPLEVEL_SENTINELS = [
    {
      property: "$session_id",
      field: "session_id"
    },
    {
      property: "$window_id",
      field: "window_id"
    }
  ];
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/capture-v1/sender.mjs
class V1CaptureSender {
  constructor(config, hooks) {
    this.config = config;
    this.maxBackoffMs = config.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.fetchFn = hooks.fetch;
    this.onError = hooks.onError;
    this.now = hooks.now ?? Date.now;
    this.sleep = hooks.sleep ?? ((ms) => new Promise((resolve) => safeSetTimeout(resolve, ms)));
    this.generateRequestId = hooks.generateRequestId ?? uuidv7;
    this.compress = hooks.compress ?? gzipCompress;
  }
  async sendV1Batch(messages) {
    if (messages.length === 0)
      return;
    const requestId = this.generateRequestId();
    const createdAt = new Date(this.now()).toISOString();
    const { batch } = buildV1Batch(messages, {
      createdAt,
      historicalMigration: this.config.historicalMigration
    });
    const url = `${this.config.host}${V1_ANALYTICS_PATH}`;
    const drops = [];
    let pending = batch;
    const maxAttempts = Math.max(1, this.config.maxAttempts);
    for (let attempt = 1;attempt <= maxAttempts; attempt++) {
      const isLastAttempt = attempt === maxAttempts;
      const payload = safeJsonStringify({
        created_at: createdAt,
        ...this.config.historicalMigration ? {
          historical_migration: true
        } : {},
        batch: pending
      });
      let captureAttempt;
      let retryDelayMs;
      try {
        captureAttempt = await this.sendOnce(url, payload, attempt, requestId);
        const { response, signal } = captureAttempt;
        const { status } = response;
        if (status < 200 || status >= 300)
          if (!isLastAttempt && RETRYABLE_STATUSES.has(status)) {
            const retryAfterMs = this.parseRetryAfter(response);
            await captureAttempt.waitFor(captureAttempt.cancelBody()).catch(() => {});
            retryDelayMs = this.backoffDelay(attempt, retryAfterMs);
          } else {
            const httpError = await this.buildHttpError(response, status, captureAttempt.waitFor);
            return this.surfaceBatchFailure(requestId, drops, pending, httpError);
          }
        else {
          let parsed;
          try {
            parsed = await captureAttempt.waitFor(this.parseResponse(response));
          } catch (error) {
            if (signal.aborted)
              throw error;
            return this.surfaceBatchFailure(requestId, drops, pending, new Error(`Capture V1 returned an unparseable ${status} response body`));
          }
          const retryable = this.classify(pending, parsed, drops);
          if (retryable.length === 0)
            return this.surfacePartialDrops(requestId, drops);
          if (isLastAttempt)
            return void this.onError(new CaptureV1Error({
              requestId,
              drops,
              retryExhausted: retryable.map((event) => event.uuid)
            }));
          pending = retryable;
          const retryAfterMs = this.parseRetryAfter(response);
          retryDelayMs = this.backoffDelay(attempt, retryAfterMs);
        }
      } catch (transportError) {
        if (captureAttempt && !captureAttempt.signal.aborted)
          throw transportError;
        if (isLastAttempt)
          return this.surfaceBatchFailure(requestId, drops, pending, transportError);
        retryDelayMs = this.backoffDelay(attempt);
      } finally {
        captureAttempt?.cleanup();
      }
      if (retryDelayMs !== undefined)
        await this.sleep(retryDelayMs);
    }
  }
  async sendOnce(url, payload, attempt, requestId) {
    const headers = this.buildHeaders(attempt, requestId);
    let body = payload;
    if (this.config.compressionEnabled) {
      const compressed = await this.compress(payload, this.config.isDebug);
      if (compressed !== null) {
        body = compressed;
        headers["Content-Encoding"] = "gzip";
      }
    }
    const controller = new AbortController;
    let timeoutPhase = "waiting for response headers";
    let timer;
    const deadline = new Promise((_resolve, reject) => {
      timer = safeSetTimeout(() => {
        const timeoutError = new Error(`Capture V1 request timed out ${timeoutPhase} after ${this.config.requestTimeoutMs}ms`);
        timeoutError.name = "AbortError";
        reject(timeoutError);
        controller.abort(timeoutError);
      }, this.config.requestTimeoutMs);
    });
    try {
      const fetchPromise = this.fetchFn(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });
      let responseAccepted = false;
      fetchPromise.then((lateResponse) => {
        if (controller.signal.aborted && !responseAccepted)
          this.cancelBody(lateResponse);
      }).catch(() => {});
      const response = await Promise.race([
        fetchPromise,
        deadline
      ]);
      responseAccepted = true;
      timeoutPhase = "while reading the response body";
      let cleanedUp = false;
      let cancellation;
      const cancelBody = () => cancellation ??= this.cancelBody(response);
      return {
        response,
        signal: controller.signal,
        waitFor: (operation) => Promise.race([
          operation,
          deadline
        ]),
        cancelBody,
        cleanup: () => {
          if (cleanedUp)
            return;
          cleanedUp = true;
          clearTimeout(timer);
          if (controller.signal.aborted)
            cancelBody();
        }
      };
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  }
  buildHeaders(attempt, requestId) {
    const sdkInfo = `${this.config.libraryId}/${this.config.libraryVersion}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "PostHog-Sdk-Info": sdkInfo,
      "PostHog-Attempt": String(attempt),
      "PostHog-Request-Id": requestId,
      "PostHog-Request-Timestamp": new Date(this.now()).toISOString()
    };
    if (this.config.userAgent)
      headers["User-Agent"] = this.config.userAgent;
    return headers;
  }
  classify(pending, parsed, drops) {
    const results = parsed.results ?? {};
    const retryable = [];
    for (const event of pending) {
      const result = results[event.uuid];
      if (result) {
        if (result.result === "drop")
          drops.push({
            uuid: event.uuid,
            details: result.details ?? undefined
          });
        else if (result.result === "retry")
          retryable.push(event);
      }
    }
    return retryable;
  }
  backoffDelay(attempt, retryAfterMs) {
    const exponential = Math.min(this.config.initialRetryDelayMs * 2 ** (attempt - 1), this.maxBackoffMs);
    if (retryAfterMs === undefined)
      return exponential;
    return Math.max(exponential, Math.min(retryAfterMs, this.maxBackoffMs));
  }
  parseRetryAfter(response) {
    const raw = response.headers?.get("Retry-After");
    if (!raw)
      return;
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const seconds = parseInt(trimmed, 10);
      return Number.isFinite(seconds) && seconds > 0 ? 1000 * seconds : undefined;
    }
    const dateMs = Date.parse(trimmed);
    if (Number.isNaN(dateMs))
      return;
    const delta = dateMs - this.now();
    return delta > 0 ? delta : undefined;
  }
  async parseResponse(response) {
    const text = await response.text();
    const parsed = JSON.parse(text);
    if (typeof parsed != "object" || parsed === null || Array.isArray(parsed))
      throw new Error("unexpected response shape");
    const results = parsed.results;
    if (results !== undefined && (typeof results != "object" || results === null || Array.isArray(results)))
      throw new Error("unexpected results shape");
    return {
      results: results ?? {}
    };
  }
  async buildHttpError(response, status, waitFor) {
    let bodyText = "";
    try {
      bodyText = (await waitFor(response.text())).slice(0, 512);
    } catch {}
    const suffix = bodyText ? `: ${bodyText}` : "";
    return new Error(`Capture V1 request failed with HTTP ${status}${suffix}`);
  }
  surfaceBatchFailure(requestId, drops, pending, cause) {
    this.onError(new CaptureV1Error({
      requestId,
      drops,
      retryExhausted: pending.map((event) => event.uuid),
      cause
    }));
  }
  surfacePartialDrops(requestId, drops) {
    if (drops.length > 0)
      this.onError(new CaptureV1Error({
        requestId,
        drops,
        retryExhausted: []
      }));
  }
  async cancelBody(response) {
    try {
      await response.body?.cancel();
    } catch {}
  }
}
var V1_ANALYTICS_PATH = "/i/v1/analytics/events", DEFAULT_MAX_BACKOFF_MS = 30000, RETRYABLE_STATUSES;
var init_sender2 = __esm(() => {
  init_dist();
  init_errors3();
  init_transform();
  RETRYABLE_STATUSES = new Set([
    408,
    500,
    502,
    503,
    504
  ]);
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/ai-capture/routing.mjs
var AI_CAPTURE_ROUTE = "ai-capture", AI_CAPTURE_ENDPOINT_PATH = "/i/v0/ai/batch/", AI_MAX_EVENT_BYTES = 8388608, AI_BATCH_TARGET_BYTES = 5242880;
var init_routing2 = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/ai-capture/batching.mjs
function eventByteSize(message) {
  return encoder.encode(safeJsonStringify(message)).length;
}
function partitionAiBatch(messages, maxEventBytes = AI_MAX_EVENT_BYTES, targetBatchBytes = AI_BATCH_TARGET_BYTES) {
  const batches = [];
  const dropped = [];
  let current = [];
  let currentBytes = 0;
  for (const message of messages) {
    if (message === undefined)
      continue;
    const bytes = eventByteSize(message);
    if (bytes > maxEventBytes) {
      dropped.push({
        event: typeof message.event == "string" ? message.event : "unknown",
        bytes
      });
      continue;
    }
    if (current.length > 0 && currentBytes + bytes > targetBatchBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(message);
    currentBytes += bytes;
  }
  if (current.length > 0)
    batches.push(current);
  return {
    batches,
    dropped
  };
}
var encoder;
var init_batching = __esm(() => {
  init_dist();
  init_routing2();
  encoder = new TextEncoder;
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/emails/errors.mjs
function emailErrorName(status, code) {
  if (code === "missing_secret_key" || status === 401)
    return "missing_api_key";
  if (status === undefined) {
    if (code === "network_error")
      return "service_unavailable";
    return code.startsWith("invalid_") ? "validation_error" : "application_error";
  }
  switch (status) {
    case 400:
      return "validation_error";
    case 403:
      return "invalid_permission";
    case 404:
      return "not_found";
    case 409:
      return code === "template_outdated" ? "validation_error" : "concurrent_idempotent_requests";
    case 422:
      return code === "idempotency_key_reused" ? "invalid_idempotent_request" : "validation_error";
    case 429:
      return code === "quota_limited" ? "monthly_quota_exceeded" : "rate_limit_exceeded";
    case 503:
      return "service_unavailable";
    default:
      return "application_error";
  }
}
var EmailError;
var init_errors4 = __esm(() => {
  EmailError = class EmailError extends Error {
    constructor(params) {
      super(params.message, params.cause === undefined ? undefined : {
        cause: params.cause
      });
      this.name = emailErrorName(params.statusCode, params.code);
      this.code = params.code;
      this.statusCode = params.statusCode;
      this.why = params.why;
      this.fix = params.fix;
      this.docsUrl = params.docsUrl;
      this.field = params.field;
      this.retryAfterMs = params.retryAfterMs;
    }
  };
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/emails/emails.mjs
class EmailSender {
  constructor(config, hooks) {
    this.inFlight = new Set;
    this.config = config;
    this.hooks = hooks;
  }
  send(options, ...unexpected) {
    return this.track(this.sendUntracked(options, unexpected));
  }
  get(id) {
    return this.track(this.getUntracked(id));
  }
  track(pending) {
    this.inFlight.add(pending);
    pending.finally(() => this.inFlight.delete(pending));
    return pending;
  }
  async drain() {
    while (this.inFlight.size > 0)
      await Promise.all(this.inFlight);
  }
  async sendUntracked(options, unexpected) {
    try {
      refuseSecondArgument(unexpected);
      const prepared = prepareSend(options, this.config.maxRetries);
      const { appHost, secretKey } = this.connect("no email was sent", "Sending email needs secretKey, a project secret API key with the transactional_email:write scope.");
      const headers = this.headers(secretKey, {
        "Content-Type": "application/json",
        "Idempotency-Key": prepared.idempotencyKey
      });
      const result = await this.withRetries(prepared.maxRetries, async () => parseSendReply(await this.request(appHost + prepared.path, "POST", headers, prepared.body)));
      for (const warning of result.warnings)
        this.hooks.logger.warn(`PostHog email warning ${warning.code}: ${warning.message}`);
      return {
        data: result,
        error: null
      };
    } catch (error) {
      return {
        data: null,
        error: asEmailError(error, "Sending the email failed unexpectedly.")
      };
    }
  }
  async getUntracked(id) {
    try {
      if (typeof id != "string" || !UUID_PATTERN.test(id))
        throw invalid("invalid_message_id", "id must be the message ID that send() returned.", "id");
      const { appHost, secretKey } = this.connect("no email status was read", "Reading an email status needs secretKey, a project secret API key with the transactional_email:read or transactional_email:write scope.");
      const url = appHost + STATUS_PATH.replace("{messageId}", id.toLowerCase());
      const headers = this.headers(secretKey, {});
      const status = await this.withRetries(this.config.maxRetries, async () => parseStatusReply(await this.request(url, "GET", headers)));
      return {
        data: status,
        error: null
      };
    } catch (error) {
      return {
        data: null,
        error: asEmailError(error, "Reading the email status failed unexpectedly.")
      };
    }
  }
  connect(nothingDone, missingSecretKey) {
    if (this.hooks.isDisabled())
      throw new EmailError({
        code: "client_disabled",
        message: `The PostHog client is disabled, so ${nothingDone}.`
      });
    if (this.hooks.isClosed())
      throw new EmailError({
        code: "client_closed",
        message: `The PostHog client is shut down, so ${nothingDone}.`
      });
    const appHost = resolveAppHost(this.config.host, this.config.appHost);
    if (!appHost)
      throw new EmailError({
        code: "missing_app_host",
        message: "The client's host is not PostHog Cloud, so the client can't tell where to send email. Set appHost to your PostHog app host on the client."
      });
    const secretKey = this.config.secretKey?.trim();
    if (!secretKey)
      throw new EmailError({
        code: "missing_secret_key",
        message: missingSecretKey
      });
    return {
      appHost,
      secretKey
    };
  }
  headers(secretKey, extra) {
    const headers = {
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      ...extra
    };
    if (this.hooks.userAgent)
      headers["User-Agent"] = this.hooks.userAgent;
    if (this.config.migratedFrom)
      headers["X-PostHog-Migrated-From"] = this.config.migratedFrom;
    return headers;
  }
  async withRetries(maxRetries, attemptOnce) {
    for (let attempt = 0;; attempt++) {
      let error;
      try {
        return await attemptOnce();
      } catch (caught) {
        error = caught instanceof EmailError ? caught : new EmailError({
          code: "network_error",
          message: "The request to PostHog failed.",
          cause: caught
        });
      }
      const delayMs = retryDelayMs(error, attempt, maxRetries);
      if (delayMs === undefined)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  async request(url, method, headers, body) {
    const controller = new AbortController;
    const timeoutMs = this.config.requestTimeoutMs;
    let timer;
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        const timeoutError = new Error(`Email request timed out after ${timeoutMs}ms`);
        timeoutError.name = "AbortError";
        reject(timeoutError);
        controller.abort(timeoutError);
      }, timeoutMs);
    });
    const fetchPromise = Promise.resolve().then(() => this.hooks.fetch(url, {
      method,
      headers,
      ...body === undefined ? {} : {
        body
      },
      signal: controller.signal
    }));
    fetchPromise.then((lateResponse) => {
      if (controller.signal.aborted)
        Promise.resolve(lateResponse.body?.cancel()).catch(() => {});
    }).catch(() => {});
    let response;
    try {
      response = await Promise.race([
        fetchPromise,
        deadline
      ]);
      let text;
      try {
        text = await Promise.race([
          response.text(),
          deadline
        ]);
      } catch (error) {
        if (response.status >= 200 && response.status < 300)
          throw error;
        return {
          status: response.status,
          payload: null,
          retryAfterMs: readRetryAfter(response)
        };
      }
      return {
        status: response.status,
        payload: parseJson(text),
        retryAfterMs: readRetryAfter(response)
      };
    } finally {
      clearTimeout(timer);
      if (controller.signal.aborted && response)
        Promise.resolve(response.body?.cancel()).catch(() => {});
    }
  }
}
function refuseSecondArgument(unexpected) {
  if (unexpected.some((argument) => argument !== undefined))
    throw new EmailError({
      code: "invalid_form",
      message: "send takes one options object, so no email was sent. Put idempotencyKey and every other option in it."
    });
}
function prepareSend(options, defaultMaxRetries) {
  const send = options ?? {};
  const { to, distinctId, idempotencyKey, maxRetries } = send;
  if (typeof to != "string" || !to.trim())
    throw invalid("invalid_recipient", "to must be one email address as a nonempty string.", "to");
  if (distinctId !== undefined && (typeof distinctId != "string" || !distinctId))
    throw invalid("invalid_distinct_id", "distinctId must be a nonempty string.", "distinctId");
  const content = contentOf(send, distinctId);
  if (idempotencyKey !== undefined && (typeof idempotencyKey != "string" || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)))
    throw invalid("invalid_idempotency_key", "idempotencyKey must be 1 to 255 visible ASCII characters without spaces.", "idempotencyKey");
  if (maxRetries !== undefined && !isRetryCount(maxRetries))
    throw invalid("invalid_max_retries", "maxRetries must be a nonnegative integer.", "maxRetries");
  return {
    path: SEND_PATH,
    body: safeJsonStringify({
      ...content,
      to
    }),
    idempotencyKey: idempotencyKey ?? globalThis.crypto.randomUUID(),
    maxRetries: isRetryCount(maxRetries) ? maxRetries : defaultMaxRetries
  };
}
function isRetryCount(value) {
  return typeof value == "number" && Number.isInteger(value) && value >= 0;
}
function contentOf(send, distinctId) {
  if (send.templateId === undefined === (send.templateKey === undefined))
    throw new EmailError({
      code: "invalid_form",
      message: "Send either templateId, or templateKey with subject and html or text."
    });
  return send.templateKey === undefined ? templateContent(send, distinctId) : codeContent(send, distinctId);
}
function templateContent(send, distinctId) {
  const { templateId, templateData } = send;
  if (typeof templateId != "string" || !UUID_PATTERN.test(templateId))
    throw invalid("invalid_template_id", "templateId must be the template's UUID.", "templateId");
  if (templateData !== undefined && (typeof templateData != "object" || templateData === null || Array.isArray(templateData)))
    throw invalid("invalid_template_data", "templateData must be an object.", "templateData");
  refuseFieldsOutside(send, TEMPLATE_FORM, CODE_FORM);
  return {
    template_id: templateId.toLowerCase(),
    message_data: templateData ?? {},
    ...distinctId !== undefined && {
      distinct_id: distinctId
    }
  };
}
function codeContent(send, distinctId) {
  const { templateKey, subject, html, text, from, replyTo, captureEngagement } = send;
  if (typeof templateKey != "string" || !TEMPLATE_KEY_PATTERN.test(templateKey))
    throw invalid("invalid_template_key", "templateKey can only have letters, digits, hyphens (-) and underscores (_), at most 400.", "templateKey");
  refuseFieldsOutside(send, CODE_FORM, TEMPLATE_FORM);
  if (typeof subject != "string")
    throw invalid("invalid_form", "A send with templateKey needs a subject.", "subject");
  if (html !== undefined && typeof html != "string")
    throw invalid("invalid_form", "html must be a string.", "html");
  if (text !== undefined && typeof text != "string")
    throw invalid("invalid_form", "text must be a string.", "text");
  if (html === undefined && text === undefined)
    throw invalid("invalid_form", "A send with templateKey needs html, text or both.", "html");
  const sendsReplyTo = replyTo !== undefined && !(Array.isArray(replyTo) && replyTo.length === 0);
  return {
    template_key: templateKey,
    subject,
    ...html !== undefined && {
      html
    },
    ...text !== undefined && {
      text
    },
    ...from !== undefined && {
      from
    },
    ...sendsReplyTo && {
      reply_to: typeof replyTo == "string" ? [
        replyTo
      ] : replyTo
    },
    capture_engagement: captureEngagement ?? true,
    ...distinctId !== undefined && {
      distinct_id: distinctId
    }
  };
}
function refuseFieldsOutside(send, form, otherForm) {
  const field = Object.entries(send).find(([name, value]) => value !== undefined && !form.fields.has(name))?.[0];
  if (field === undefined)
    return;
  const message = `A send with ${form.name} doesn't take ${field}, so no email was sent.`;
  if (!otherForm.fields.has(field))
    throw new EmailError({
      code: "invalid_form",
      message,
      field,
      fix: `Remove ${field} and send again.`
    });
  throw new EmailError({
    code: "invalid_form",
    message,
    field,
    why: form.why,
    fix: `Remove ${field}, or ${otherForm.howToSend}.`
  });
}
function fieldSet(...groups) {
  return new Set(groups.flatMap((group) => Object.keys(group)));
}
function invalid(code, message, field) {
  return new EmailError({
    code,
    message,
    field
  });
}
function resolveAppHost(host, appHost) {
  const explicit = typeof appHost == "string" ? removeTrailingSlash(appHost.trim()) : "";
  if (explicit)
    return CLOUD_APP_HOSTS[explicit] ?? explicit;
  return CLOUD_APP_HOSTS[removeTrailingSlash(host)];
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function readRetryAfter(response) {
  try {
    return parseRetryAfterMs(response.headers?.get("retry-after"), Date.now(), Number.MAX_SAFE_INTEGER);
  } catch {
    return;
  }
}
function emails_text(value) {
  return typeof value == "string" && value ? value : undefined;
}
function replyFields(payload) {
  return payload === null || typeof payload != "object" || Array.isArray(payload) ? {} : payload;
}
function parseSendReply({ status, payload, retryAfterMs }) {
  const fields = replyFields(payload);
  if (status >= 200 && status < 300) {
    const id = emails_text(fields.message_id);
    if (!id)
      throw new EmailError({
        code: "api_error",
        message: "PostHog answered without a message ID.",
        statusCode: status
      });
    const warnings = [];
    if (Array.isArray(fields.warnings)) {
      for (const warning of fields.warnings)
        if (warning !== null && typeof warning == "object")
          warnings.push({
            code: emails_text(warning.code) ?? "warning",
            message: emails_text(warning.detail) ?? emails_text(warning.message) ?? "",
            fix: emails_text(warning.fix)
          });
    }
    return {
      id,
      replayed: fields.replayed === true,
      warnings
    };
  }
  throw replyError(fields, status, retryAfterMs);
}
function parseStatusReply({ status, payload, retryAfterMs }) {
  const fields = replyFields(payload);
  if (status < 200 || status >= 300)
    throw replyError(fields, status, retryAfterMs);
  const id = emails_text(fields.id);
  const deliveryStatus = emails_text(fields.status);
  const createdAt = emails_text(fields.created_at);
  const statusAt = emails_text(fields.status_at);
  if (!id || !deliveryStatus || !createdAt || !statusAt)
    throw new EmailError({
      code: "api_error",
      message: "PostHog answered without an email status.",
      statusCode: status
    });
  return {
    id,
    status: deliveryStatus,
    createdAt,
    statusAt,
    reason: emails_text(fields.reason) ?? null
  };
}
function replyError(fields, status, retryAfterMs) {
  return new EmailError({
    code: emails_text(fields.code) ?? "api_error",
    message: emails_text(fields.detail) ?? `PostHog answered HTTP ${status}.`,
    statusCode: status,
    why: emails_text(fields.why),
    fix: emails_text(fields.fix),
    docsUrl: emails_text(fields.docs_url),
    field: emails_text(fields.attr),
    retryAfterMs
  });
}
function asEmailError(error, message) {
  return error instanceof EmailError ? error : new EmailError({
    code: "unexpected_error",
    message,
    cause: error
  });
}
function isRetryable(error) {
  if (error.statusCode === undefined)
    return error.code === "network_error";
  if (error.statusCode === 409)
    return error.code === "idempotency_key_in_flight";
  if (error.statusCode === 429)
    return error.code !== "quota_limited";
  return error.statusCode === 503;
}
function retryDelayMs(error, attempt, maxRetries) {
  if (attempt >= maxRetries || !isRetryable(error))
    return;
  if (error.retryAfterMs !== undefined && error.retryAfterMs > MAX_RETRY_DELAY_MS)
    return;
  const backoffMs = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempt * (0.8 + 0.4 * Math.random()));
  return Math.max(backoffMs, error.retryAfterMs ?? 0);
}
var SEND_PATH = "/api/projects/@current/messaging/send/email/", STATUS_PATH = "/api/projects/@current/messaging/emails/{messageId}/", US_APP_HOST = "https://us.posthog.com", EU_APP_HOST = "https://eu.posthog.com", CLOUD_APP_HOSTS, MAX_RETRY_DELAY_MS = 30000, UUID_PATTERN, IDEMPOTENCY_KEY_PATTERN, TEMPLATE_KEY_PATTERN, SHARED_FIELDS, TEMPLATE_FIELDS, CODE_FIELDS, TEMPLATE_FORM, CODE_FORM, DEFAULT_EMAIL_REQUEST_TIMEOUT_MS = 15000, DEFAULT_EMAIL_REQUEST_MAX_RETRIES = 2;
var init_emails = __esm(() => {
  init_dist();
  init_errors4();
  CLOUD_APP_HOSTS = {
    "https://us.i.posthog.com": US_APP_HOST,
    "https://us.posthog.com": US_APP_HOST,
    "https://app.posthog.com": US_APP_HOST,
    "https://eu.i.posthog.com": EU_APP_HOST,
    "https://eu.posthog.com": EU_APP_HOST
  };
  UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;
  TEMPLATE_KEY_PATTERN = /^[a-zA-Z0-9_-]{1,400}$/;
  SHARED_FIELDS = {
    to: true,
    distinctId: true,
    idempotencyKey: true,
    maxRetries: true
  };
  TEMPLATE_FIELDS = {
    templateId: true,
    templateData: true
  };
  CODE_FIELDS = {
    templateKey: true,
    subject: true,
    from: true,
    replyTo: true,
    captureEngagement: true,
    html: true,
    text: true
  };
  TEMPLATE_FORM = {
    name: "templateId",
    fields: fieldSet(SHARED_FIELDS, TEMPLATE_FIELDS),
    why: "A template made in PostHog sets its own sender, subject and content, and follows the project's engagement setting.",
    howToSend: "send a template made in PostHog with templateId"
  };
  CODE_FORM = {
    name: "templateKey",
    fields: fieldSet(SHARED_FIELDS, CODE_FIELDS),
    why: "A send with templateKey takes its content from your code.",
    howToSend: "send content from your code with templateKey"
  };
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/client.mjs
function emitDeprecationWarningOnce(id, message) {
  if (_emittedDeprecations.has(id))
    return;
  _emittedDeprecations.add(id);
  console.warn(`[PostHog] ${message}`);
}
function normalizeApiKey(value) {
  return typeof value == "string" ? value.trim() : "";
}
function normalizePersonalApiKey(value) {
  const normalizedValue = typeof value == "string" ? value.trim() : "";
  return normalizedValue || undefined;
}
function normalizeHost(value) {
  const normalizedValue = typeof value == "string" ? value.trim() : "";
  return normalizedValue || DEFAULT_NODE_HOST;
}
function positiveNumberOr(value, fallback) {
  return typeof value == "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function nonNegativeIntegerOr(value, fallback) {
  return typeof value == "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
function normalizeUnsetPersonProperties(value) {
  const propertyNames = Array.isArray(value) ? value : [
    value
  ];
  return propertyNames.filter((propertyName) => typeof propertyName == "string" && propertyName.trim().length > 0);
}
function buildFlagEventProperties(flagValues) {
  if (!flagValues)
    return {};
  const additionalProperties = {};
  for (const [feature, variant] of Object.entries(flagValues))
    additionalProperties[`$feature/${feature}`] = variant;
  const activeFlags = Object.keys(flagValues).filter((flag) => flagValues[flag] !== false).sort();
  if (activeFlags.length > 0)
    additionalProperties["$active_feature_flags"] = activeFlags;
  return additionalProperties;
}
var MINIMUM_POLLING_INTERVAL = 100, THIRTY_SECONDS = 30000, MAX_CACHE_SIZE = 50000, WAITUNTIL_DEBOUNCE_MS = 50, WAITUNTIL_MAX_WAIT_MS = 500, DEFAULT_NODE_HOST = "https://us.i.posthog.com", _emittedDeprecations, PostHogBackendClient;
var init_client2 = __esm(() => {
  init_version();
  init_dist();
  init_types3();
  init_feature_flag_evaluations();
  init_feature_flags();
  init_error_tracking2();
  init_trace_context();
  init_storage_memory();
  init_listeners();
  init_event_context();
  init_config3();
  init_routing();
  init_sender2();
  init_batching();
  init_routing2();
  init_emails();
  _emittedDeprecations = new Set;
  PostHogBackendClient = class PostHogBackendClient extends PostHogCoreStateless {
    get distinctIdHasSentFlagCalls() {
      return Object.fromEntries(this._distinctIdHasSentFlagCalls);
    }
    set distinctIdHasSentFlagCalls(value) {
      this._distinctIdHasSentFlagCalls = new Map(Object.entries(value ?? {}));
    }
    constructor(apiKey, options = {}) {
      const normalizedApiKey = normalizeApiKey(apiKey);
      const normalizedOptions = {
        ...options,
        maxQueueSize: options.maxQueueSize ?? 1e4,
        flushInterval: options.flushInterval ?? 5000,
        host: normalizeHost(options.host),
        personalApiKey: normalizePersonalApiKey(options.secretKey ?? options.personalApiKey)
      };
      super(normalizedApiKey, normalizedOptions), this._memoryStorage = new PostHogMemoryStorage, this._isShutdown = false, this._aiCaptureRouteActive = false, this._minimalFlagCalledEvents = false;
      this.options = normalizedOptions;
      this.captureMode = resolveCaptureMode();
      this.enableFullAiCapture = normalizedOptions.enableFullAiCapture === true;
      this.privacyMode = normalizedOptions.privacyMode === true;
      this.context = this.initializeContext();
      this.options.featureFlagsPollingInterval = typeof normalizedOptions.featureFlagsPollingInterval == "number" ? Math.max(normalizedOptions.featureFlagsPollingInterval, MINIMUM_POLLING_INTERVAL) : normalizedOptions.featureFlagsPollingInterval === null ? null : THIRTY_SECONDS;
      if (typeof normalizedOptions.waitUntilDebounceMs == "number")
        this.options.waitUntilDebounceMs = Math.max(normalizedOptions.waitUntilDebounceMs, 0);
      if (typeof normalizedOptions.waitUntilMaxWaitMs == "number")
        this.options.waitUntilMaxWaitMs = Math.max(normalizedOptions.waitUntilMaxWaitMs, 0);
      if (!this.disabled && (normalizedOptions.personalApiKey || normalizedOptions.flagDefinitionCacheProvider)) {
        if (normalizedOptions.personalApiKey?.includes("phc_"))
          throw new Error('A project API key ("phc_...") was provided as secretKey or personalApiKey. Pass the project API key as the first constructor argument. For local evaluation, set secretKey (or the deprecated personalApiKey alias) to a server-only Project Secret API Key ("phs_...") or Personal API Key ("phx_...") with feature flag read access.');
        const shouldEnableLocalEvaluation = normalizedOptions.enableLocalEvaluation !== false;
        if (shouldEnableLocalEvaluation)
          this.featureFlagsPoller = new FeatureFlagsPoller({
            pollingInterval: this.options.featureFlagsPollingInterval,
            personalApiKey: normalizedOptions.personalApiKey,
            projectApiKey: normalizedApiKey,
            timeout: normalizedOptions.requestTimeout ?? 1e4,
            host: this.host,
            fetch: normalizedOptions.fetch,
            onError: (err) => {
              this._events.emit("error", err);
            },
            onLoad: (count) => {
              this._events.emit("localEvaluationFlagsLoaded", count);
            },
            onMinimalFlagCalledEvents: (enabled) => {
              this._minimalFlagCalledEvents = enabled;
            },
            customHeaders: this.getCustomHeaders(),
            cacheProvider: normalizedOptions.flagDefinitionCacheProvider,
            strictLocalEvaluation: normalizedOptions.strictLocalEvaluation,
            evaluationContexts: normalizedOptions.evaluationContexts ?? normalizedOptions.evaluationEnvironments
          });
      }
      this.errorTracking = new error_tracking_default(this, normalizedOptions, this._logger);
      this._distinctIdHasSentFlagCalls = new Map;
      this.maxCacheSize = normalizedOptions.maxCacheSize || MAX_CACHE_SIZE;
    }
    enqueue(type, message, options, explicitRoute) {
      super.enqueue(type, message, options, explicitRoute);
      this.scheduleDebouncedFlush();
    }
    _flushEventsAndSpans(skipThrottledSpans = false) {
      const events = this.flushWithPendingPromises();
      if (!this._traces || skipThrottledSpans && this._traces.throttled)
        return events;
      return allSettled([
        events,
        this._traces.flush().catch(() => {})
      ]).then(([eventsResult]) => {
        if (eventsResult.status === "rejected")
          throw eventsResult.reason;
      });
    }
    flushAutomatic() {
      return this._flushKeepingRuntimeAlive(true);
    }
    async flush() {
      this.errorTracking.capturePendingExceptions();
      return this._flushKeepingRuntimeAlive(false);
    }
    _flushKeepingRuntimeAlive(skipThrottledSpans) {
      const flushPromise = this._flushEventsAndSpans(skipThrottledSpans);
      const waitUntil = this.options.waitUntil;
      if (waitUntil && !this._waitUntilCycle)
        try {
          waitUntil(flushPromise.catch(() => {}));
        } catch {}
      return flushPromise;
    }
    scheduleDebouncedFlush() {
      const waitUntil = this.options.waitUntil;
      if (!waitUntil)
        return;
      if (this.disabled || this.optedOut)
        return;
      if (!this._waitUntilCycle) {
        let resolve;
        const promise = new Promise((r) => {
          resolve = r;
        });
        try {
          waitUntil(promise);
        } catch {
          return;
        }
        this._waitUntilCycle = {
          resolve,
          startedAt: Date.now(),
          timer: undefined
        };
      }
      const elapsed = Date.now() - this._waitUntilCycle.startedAt;
      const maxWaitMs = this.options.waitUntilMaxWaitMs ?? WAITUNTIL_MAX_WAIT_MS;
      const flushNow = elapsed >= maxWaitMs;
      if (this._waitUntilCycle.timer !== undefined)
        clearTimeout(this._waitUntilCycle.timer);
      if (flushNow)
        return void this.resolveWaitUntilFlush();
      const debounceMs = this.options.waitUntilDebounceMs ?? WAITUNTIL_DEBOUNCE_MS;
      this._waitUntilCycle.timer = safeSetTimeout(() => {
        this.resolveWaitUntilFlush();
      }, debounceMs);
    }
    _consumeWaitUntilCycle() {
      const cycle = this._waitUntilCycle;
      if (cycle) {
        clearTimeout(cycle.timer);
        this._waitUntilCycle = undefined;
      }
      return cycle?.resolve;
    }
    async resolveWaitUntilFlush() {
      const resolve = this._consumeWaitUntilCycle();
      try {
        await this._flushEventsAndSpans();
      } catch {} finally {
        resolve?.();
      }
    }
    getPersistedProperty(key) {
      return this._memoryStorage.getProperty(key);
    }
    setPersistedProperty(key, value) {
      return this._memoryStorage.setProperty(key, value);
    }
    fetch(url, options) {
      return this.options.fetch ? this.options.fetch(url, options) : fetch(url, options);
    }
    getQueueRouteKey(message) {
      return this.captureMode === "v1" && isLegacyOnlyEvent(message) ? AI_ROUTE : ANALYTICS_ROUTE;
    }
    persistedQueueKeyForRoute(route) {
      if (route === AI_CAPTURE_ROUTE)
        return types_PostHogPersistedProperty.AiCaptureQueue;
      return route === AI_ROUTE ? types_PostHogPersistedProperty.AiQueue : types_PostHogPersistedProperty.Queue;
    }
    getActiveQueueRoutes() {
      const routes = this.captureMode === "v1" ? [
        ANALYTICS_ROUTE,
        AI_ROUTE
      ] : [
        ANALYTICS_ROUTE
      ];
      if (this._aiCaptureRouteActive)
        routes.push(AI_CAPTURE_ROUTE);
      return routes;
    }
    getBatchEndpointPath(route) {
      return route === AI_CAPTURE_ROUTE ? AI_CAPTURE_ENDPOINT_PATH : super.getBatchEndpointPath(route);
    }
    async sendBatch(batchMessages, retryOptions, route = ANALYTICS_ROUTE) {
      if (route === AI_CAPTURE_ROUTE)
        return this.sendAiCaptureBatch(batchMessages, retryOptions);
      if (this.captureMode !== "v1" || route === AI_ROUTE)
        return super.sendBatch(batchMessages, retryOptions, route);
      const v1Events = batchMessages.filter((message) => message !== undefined);
      await this.getV1Sender().sendV1Batch(v1Events);
    }
    async sendAiCaptureBatch(batchMessages, retryOptions) {
      const { batches, dropped } = partitionAiBatch(batchMessages);
      for (const { event, bytes } of dropped) {
        const message = `Event ${event} (${bytes} bytes) exceeds the ${AI_MAX_EVENT_BYTES / 1048576}MiB limit for ${AI_CAPTURE_ENDPOINT_PATH}, dropping.`;
        this._logger.error(message);
        this._events.emit("error", new Error(message));
      }
      for (const batch of batches)
        await this.sendAiSubBatch(batch, retryOptions);
    }
    async sendAiSubBatch(batch, retryOptions) {
      try {
        await super.sendBatch(batch, retryOptions, AI_CAPTURE_ROUTE);
      } catch (err) {
        if (!isPostHogFetchContentTooLargeError(err))
          throw err;
        if (batch.length === 1) {
          const [event] = batch;
          const eventName = typeof event.event == "string" ? event.event : "unknown";
          const message = `Event ${eventName} (${eventByteSize(event)} bytes) was rejected with 413 by ${AI_CAPTURE_ENDPOINT_PATH} on its own, dropping.`;
          this._logger.error(message);
          this._events.emit("error", new Error(message));
          return;
        }
        const mid = Math.ceil(batch.length / 2);
        await this.sendAiSubBatch(batch.slice(0, mid), retryOptions);
        await this.sendAiSubBatch(batch.slice(mid), retryOptions);
      }
    }
    getV1Sender() {
      if (!this._v1Sender)
        this._v1Sender = new V1CaptureSender({
          host: this.host,
          apiKey: this.apiKey,
          libraryId: this.getLibraryId(),
          libraryVersion: this.getLibraryVersion(),
          userAgent: this.getCustomUserAgent() || undefined,
          historicalMigration: this.historicalMigration,
          compressionEnabled: !this.disableCompression,
          requestTimeoutMs: this.requestTimeout,
          maxAttempts: (this.options.fetchRetryCount ?? 3) + 1,
          initialRetryDelayMs: this.options.fetchRetryDelay ?? 3000,
          isDebug: this.isDebug
        }, {
          fetch: (url, fetchOptions) => this.fetch(url, fetchOptions),
          onError: (error) => this._events.emit("error", error),
          compress: (payload) => this.compressPayload(payload)
        });
      return this._v1Sender;
    }
    getLibraryVersion() {
      return version2;
    }
    get metrics() {
      if (!this._metrics)
        this._metrics = new PostHogMetrics(this, resolveMetricsConfig(this.options.metrics), this._logger);
      return this._metrics;
    }
    get emails() {
      if (!this._emails)
        this._emails = new EmailSender({
          secretKey: this.options.personalApiKey,
          host: this.host,
          appHost: this.options.appHost,
          requestTimeoutMs: positiveNumberOr(this.options.emailRequestTimeoutMs, DEFAULT_EMAIL_REQUEST_TIMEOUT_MS),
          maxRetries: nonNegativeIntegerOr(this.options.emailRequestMaxRetries, DEFAULT_EMAIL_REQUEST_MAX_RETRIES),
          migratedFrom: this.options.migratedFrom
        }, {
          fetch: (url, fetchOptions) => this.fetch(url, fetchOptions),
          isDisabled: () => this.disabled,
          isClosed: () => this._isShutdown,
          logger: this._logger,
          userAgent: this.getCustomUserAgent() || undefined
        });
      return this._emails;
    }
    initializeSpanContextManager() {
      return new SyncSpanContextManager;
    }
    hostResourceAttributes() {
      return {};
    }
    get _spanContextManager() {
      if (!this._spanContext)
        this._spanContext = this.initializeSpanContextManager();
      return this._spanContext;
    }
    get _tracesPipeline() {
      if (!this.options.traces)
        return;
      if (!this._traces)
        this._traces = new PostHogTraces(this, resolveTracesConfig(this.options.traces, this.hostResourceAttributes(), this._logger), this._logger, () => this._tracingContext(), this._spanContextManager, () => this.scheduleDebouncedFlush());
      return this._traces;
    }
    _tracingContext() {
      const context = this.context?.get();
      return {
        distinctId: context?.distinctId,
        sessionId: context?.sessionId
      };
    }
    startSpan(name, options) {
      return this._tracesPipeline?.startSpan(name, options) ?? inertSpan(options, this._spanContextManager.active());
    }
    withSpan(name, optionsOrFn, maybeFn) {
      const options = typeof optionsOrFn == "function" ? undefined : optionsOrFn;
      const fn = typeof optionsOrFn == "function" ? optionsOrFn : maybeFn;
      const pipeline = this._tracesPipeline;
      if (!pipeline)
        return runWithActiveSpan(this._spanContextManager, inertSpan(options, this._spanContextManager.active()), fn);
      return options ? pipeline.withSpan(name, options, fn) : pipeline.withSpan(name, fn);
    }
    getActiveSpan() {
      return this._spanContextManager.active() ?? null;
    }
    getCustomUserAgent() {
      return `${this.getLibraryId()}/${this.getLibraryVersion()}`;
    }
    getEvaluationRuntime() {
      return "server";
    }
    getCommonEventProperties() {
      const commonProperties = super.getCommonEventProperties();
      if (this.options.isServer ?? true)
        commonProperties.$is_server = true;
      return commonProperties;
    }
    enable() {
      return super.optIn();
    }
    disable() {
      return super.optOut();
    }
    debug(enabled = true) {
      super.debug(enabled);
      this.featureFlagsPoller?.debug(enabled);
    }
    _warnIfInvalidCapture(props, stringArgumentWarning, exceptionCaptureWarning) {
      if (typeof props == "string")
        this._logger.warn(stringArgumentWarning);
      if (props.event === "$exception" && !props._originatedFromCaptureException)
        this._logger.warn(exceptionCaptureWarning);
    }
    _sendPreparedEvent(type, props, immediate, prepareOptions, explicitRoute) {
      return this.addPendingPromise(this._prepareEventMessage(props, prepareOptions).then(({ distinctId, event, properties, options }) => {
        const captureOptions = {
          timestamp: options.timestamp,
          disableGeoip: options.disableGeoip,
          uuid: options.uuid
        };
        const message = {
          distinctId,
          event,
          properties: {
            ...properties,
            ...this.getCommonEventProperties()
          }
        };
        return immediate ? this.sendImmediate(type, message, captureOptions, explicitRoute) : this.enqueue(type, message, captureOptions, explicitRoute);
      }).catch((err) => {
        if (err)
          console.error(err);
      }));
    }
    _capturePreparedEvent(props, immediate) {
      return this._sendPreparedEvent("capture", props, immediate);
    }
    capture(props) {
      this._warnIfInvalidCapture(props, "Called capture() with a string as the first argument when an object was expected.", "Using `posthog.capture('$exception')` is unreliable because it does not attach required metadata. Use `posthog.captureException(error)` instead, which attaches required metadata automatically.");
      this._capturePreparedEvent(props, false);
    }
    async captureImmediate(props) {
      this._warnIfInvalidCapture(props, "Called captureImmediate() with a string as the first argument when an object was expected.", "Capturing a `$exception` event via `posthog.captureImmediate('$exception')` is unreliable because it does not attach required metadata. Use `posthog.captureExceptionImmediate(error)` instead, which attaches this metadata by default.");
      return this._capturePreparedEvent(props, true);
    }
    captureAi(props) {
      if (this.disabled)
        return;
      const uuid = getEventUuid(props.uuid, uuidv7);
      this._sendPreparedAiEvent({
        ...props,
        uuid
      }, false);
      return uuid;
    }
    async captureAiImmediate(props) {
      if (this.disabled)
        return;
      const uuid = getEventUuid(props.uuid, uuidv7);
      await this._sendPreparedAiEvent({
        ...props,
        uuid
      }, true);
      return uuid;
    }
    _sendPreparedAiEvent(props, immediate) {
      if (typeof props?.event == "string" && !props.event.startsWith("$ai_"))
        this._logger.debug(`captureAi called with non-AI event ${props.event}; routing it to the AI endpoint anyway.`);
      this._aiCaptureRouteActive = true;
      return this._sendPreparedEvent("capture", props, immediate, undefined, AI_CAPTURE_ROUTE);
    }
    identify({ distinctId, properties = {}, disableGeoip }) {
      const { $set, $set_once, $anon_distinct_id, ...rest } = properties;
      const setProps = $set || rest;
      const setOnceProps = $set_once || {};
      const eventProperties = {
        $set: setProps,
        $set_once: setOnceProps,
        $anon_distinct_id: $anon_distinct_id ?? undefined
      };
      this._sendPreparedEvent("identify", {
        distinctId,
        event: "$identify",
        properties: eventProperties,
        disableGeoip
      }, false, {
        includeContextProperties: false
      });
    }
    async identifyImmediate({ distinctId, properties = {}, disableGeoip }) {
      const { $set, $set_once, $anon_distinct_id, ...rest } = properties;
      const setProps = $set || rest;
      const setOnceProps = $set_once || {};
      const eventProperties = {
        $set: setProps,
        $set_once: setOnceProps,
        $anon_distinct_id: $anon_distinct_id ?? undefined
      };
      await this._sendPreparedEvent("identify", {
        distinctId,
        event: "$identify",
        properties: eventProperties,
        disableGeoip
      }, true, {
        includeContextProperties: false
      });
    }
    setPersonProperties({ distinctId, properties = {}, propertiesOnce = {} }) {
      if (Object.keys(properties).length === 0 && Object.keys(propertiesOnce).length === 0)
        return;
      const eventProperties = {};
      if (Object.keys(properties).length > 0)
        eventProperties.$set = properties;
      if (Object.keys(propertiesOnce).length > 0)
        eventProperties.$set_once = propertiesOnce;
      this.capture({
        distinctId,
        event: "$set",
        properties: eventProperties
      });
    }
    unsetPersonProperties({ distinctId, properties }) {
      const propertyNames = normalizeUnsetPersonProperties(properties);
      if (propertyNames.length === 0)
        return;
      this.capture({
        distinctId,
        event: "$set",
        properties: {
          $unset: propertyNames
        }
      });
    }
    alias(data) {
      this._sendPreparedEvent("alias", {
        distinctId: data.distinctId,
        event: "$create_alias",
        properties: {
          distinct_id: data.distinctId,
          alias: data.alias
        },
        disableGeoip: data.disableGeoip
      }, false, {
        includeContextProperties: false
      });
    }
    async aliasImmediate(data) {
      await this._sendPreparedEvent("alias", {
        distinctId: data.distinctId,
        event: "$create_alias",
        properties: {
          distinct_id: data.distinctId,
          alias: data.alias
        },
        disableGeoip: data.disableGeoip
      }, true, {
        includeContextProperties: false
      });
    }
    isLocalEvaluationReady() {
      return this.featureFlagsPoller?.isLocalEvaluationReady() ?? false;
    }
    getFeatureFlagEvaluationRuntime(key) {
      return this.featureFlagsPoller?.getEvaluationRuntimeForFlag(key);
    }
    getFeatureFlagKeysByEvaluationRuntime(evaluationRuntime) {
      return this.featureFlagsPoller?.getFlagKeysByEvaluationRuntime(evaluationRuntime) ?? [];
    }
    async waitForLocalEvaluationReady(timeoutMs = THIRTY_SECONDS) {
      if (this.isLocalEvaluationReady())
        return true;
      if (this.featureFlagsPoller === undefined)
        return false;
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          cleanup();
          resolve(false);
        }, timeoutMs);
        const cleanup = this._events.on("localEvaluationFlagsLoaded", (count) => {
          clearTimeout(timeout);
          cleanup();
          resolve(count > 0);
        });
      });
    }
    _resolveDistinctId(distinctIdOrOptions, options) {
      if (typeof distinctIdOrOptions == "string")
        return {
          distinctId: distinctIdOrOptions,
          options
        };
      return {
        distinctId: this.context?.get()?.distinctId,
        options: distinctIdOrOptions
      };
    }
    async _getFeatureFlagResult(key, distinctId, options = {}, matchValue) {
      if (this.disabled)
        return void this._logger.warn("The client is disabled");
      const sendFeatureFlagEvents = options.sendFeatureFlagEvents ?? true;
      if (this._flagOverrides !== undefined && key in this._flagOverrides) {
        const overrideValue = this._flagOverrides[key];
        if (overrideValue === undefined)
          return;
        const overridePayload = this._payloadOverrides?.[key];
        return {
          key,
          enabled: overrideValue !== false,
          variant: typeof overrideValue == "string" ? overrideValue : undefined,
          payload: overridePayload
        };
      }
      const { groups, disableGeoip } = options;
      let { onlyEvaluateLocally, personProperties, groupProperties } = options;
      const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
      personProperties = adjustedProperties.allPersonProperties;
      groupProperties = adjustedProperties.allGroupProperties;
      const evaluationContext = this.createFeatureFlagEvaluationContext(distinctId, groups, this.personPropertiesForLocalEvaluation(distinctId, personProperties), groupProperties);
      if (onlyEvaluateLocally == undefined)
        onlyEvaluateLocally = this.options.strictLocalEvaluation ?? false;
      let result;
      let flagWasLocallyEvaluated = false;
      let requestId;
      let evaluatedAt;
      let featureFlagError;
      let flagId;
      let flagVersion;
      let flagReason;
      let flagHasExperiment;
      const localEvaluationEnabled = this.featureFlagsPoller !== undefined;
      if (localEvaluationEnabled) {
        await this.featureFlagsPoller?.loadFeatureFlags();
        const flag = this.featureFlagsPoller?.featureFlagsByKey[key];
        if (flag)
          try {
            const localResult = await this.featureFlagsPoller?.computeFlagAndPayloadLocally(flag, evaluationContext, {
              matchValue
            });
            if (localResult) {
              flagWasLocallyEvaluated = true;
              const value = localResult.value;
              flagId = flag.id;
              flagReason = "Evaluated locally";
              flagHasExperiment = flag.has_experiment;
              result = {
                key,
                enabled: value !== false,
                variant: typeof value == "string" ? value : undefined,
                payload: localResult.payload ?? undefined,
                reason: flagReason,
                reasonCode: flag.active === false ? "flag_disabled" : undefined
              };
            }
          } catch (e) {
            if (e instanceof RequiresServerEvaluation || e instanceof InconclusiveMatchError)
              this._logger?.info(`${e.name} when computing flag locally: ${key}: ${e.message}`);
            else
              throw e;
          }
      }
      if (!flagWasLocallyEvaluated && !onlyEvaluateLocally) {
        const flagsResponse = await super.getFeatureFlagDetailsStateless(evaluationContext.distinctId, evaluationContext.groups, personProperties, groupProperties, disableGeoip, [
          key
        ]);
        if (flagsResponse === undefined)
          featureFlagError = FeatureFlagError2.UNKNOWN_ERROR;
        else {
          this._minimalFlagCalledEvents = flagsResponse.minimalFlagCalledEvents === true;
          requestId = flagsResponse.requestId;
          evaluatedAt = flagsResponse.evaluatedAt;
          const errors = [];
          if (flagsResponse.errorsWhileComputingFlags)
            errors.push(FeatureFlagError2.ERRORS_WHILE_COMPUTING);
          if (flagsResponse.quotaLimited?.includes("feature_flags"))
            errors.push(FeatureFlagError2.QUOTA_LIMITED);
          const flagDetail = flagsResponse.flags[key];
          if (flagDetail === undefined)
            errors.push(FeatureFlagError2.FLAG_MISSING);
          else {
            flagId = flagDetail.metadata?.id;
            flagVersion = flagDetail.metadata?.version;
            flagReason = flagDetail.reason?.description ?? flagDetail.reason?.code;
            flagHasExperiment = flagDetail.metadata?.has_experiment;
            let parsedPayload;
            if (flagDetail.metadata?.payload !== undefined)
              try {
                parsedPayload = JSON.parse(flagDetail.metadata.payload);
              } catch {
                parsedPayload = flagDetail.metadata.payload;
              }
            result = {
              key,
              enabled: flagDetail.enabled,
              variant: flagDetail.variant ?? undefined,
              payload: parsedPayload,
              reason: flagReason,
              reasonCode: flagDetail.reason?.code
            };
          }
          if (errors.length > 0)
            featureFlagError = errors.join(",");
        }
      }
      if (sendFeatureFlagEvents) {
        const response = result === undefined ? undefined : result.enabled === false ? false : result.variant ?? true;
        const properties = {
          $feature_flag: key,
          $feature_flag_response: response,
          $feature_flag_id: flagId,
          $feature_flag_version: flagVersion,
          $feature_flag_reason: flagReason,
          locally_evaluated: flagWasLocallyEvaluated,
          [`$feature/${key}`]: response,
          $feature_flag_request_id: requestId,
          $feature_flag_evaluated_at: flagWasLocallyEvaluated ? Date.now() : evaluatedAt
        };
        if (flagHasExperiment !== undefined)
          properties.$feature_flag_has_experiment = flagHasExperiment;
        if (flagWasLocallyEvaluated && this.featureFlagsPoller) {
          const flagDefinitionsLoadedAt = this.featureFlagsPoller.getFlagDefinitionsLoadedAt();
          if (flagDefinitionsLoadedAt !== undefined)
            properties.$feature_flag_definitions_loaded_at = flagDefinitionsLoadedAt;
        }
        if (featureFlagError)
          properties.$feature_flag_error = featureFlagError;
        this._captureFlagCalledEventIfNeeded({
          distinctId,
          key,
          response,
          groups,
          disableGeoip,
          properties
        });
      }
      if (result !== undefined && this._payloadOverrides !== undefined && key in this._payloadOverrides)
        result = {
          ...result,
          payload: this._payloadOverrides[key]
        };
      return result;
    }
    async getFeatureFlag(key, distinctId, options) {
      emitDeprecationWarningOnce("getFeatureFlag", "`getFeatureFlag` is deprecated and will be removed in a future major version. Use `posthog.evaluateFlags(distinctId, ...)` and call `flags.getFlag(key)` instead — this consolidates flag evaluation into a single `/flags` request per incoming request.");
      const result = await this._getFeatureFlagResult(key, distinctId, {
        ...options,
        sendFeatureFlagEvents: this._resolveSendFeatureFlagEvents(options?.sendFeatureFlagEvents)
      });
      if (result === undefined)
        return;
      if (result.enabled === false)
        return false;
      return result.variant ?? true;
    }
    async getFeatureFlagPayload(key, distinctId, matchValue, options) {
      emitDeprecationWarningOnce("getFeatureFlagPayload", "`getFeatureFlagPayload` is deprecated and will be removed in a future major version. Use `posthog.evaluateFlags(distinctId, ...)` and call `flags.getFlagPayload(key)` instead — this consolidates flag evaluation into a single `/flags` request per incoming request.");
      if (this._payloadOverrides !== undefined && key in this._payloadOverrides)
        return this._payloadOverrides[key];
      const result = await this._getFeatureFlagResult(key, distinctId, {
        ...options,
        sendFeatureFlagEvents: false
      }, matchValue);
      if (result === undefined)
        return;
      return result.payload ?? null;
    }
    async getFeatureFlagResult(key, distinctIdOrOptions, options) {
      const { distinctId: resolvedDistinctId, options: resolvedOptions } = this._resolveDistinctId(distinctIdOrOptions, options);
      if (!resolvedDistinctId)
        return void this._logger.warn("[PostHog] distinctId is required — pass it explicitly or use withContext()");
      return this._getFeatureFlagResult(key, resolvedDistinctId, {
        ...resolvedOptions,
        sendFeatureFlagEvents: this._resolveSendFeatureFlagEvents(resolvedOptions?.sendFeatureFlagEvents)
      });
    }
    async getRemoteConfigPayload(flagKey) {
      if (this.disabled)
        return void this._logger.warn("The client is disabled");
      if (!this.options.personalApiKey)
        throw new Error("Personal API key is required for remote config payload decryption");
      const response = await this._requestRemoteConfigPayload(flagKey);
      if (!response)
        return;
      const parsed = await response.json();
      if (typeof parsed == "string")
        try {
          return JSON.parse(parsed);
        } catch (e) {}
      return parsed;
    }
    async isFeatureEnabled(key, distinctId, options) {
      emitDeprecationWarningOnce("isFeatureEnabled", "`isFeatureEnabled` is deprecated and will be removed in a future major version. Use `posthog.evaluateFlags(distinctId, ...)` and call `flags.isEnabled(key)` instead — this consolidates flag evaluation into a single `/flags` request per incoming request.");
      const result = await this._getFeatureFlagResult(key, distinctId, {
        ...options,
        sendFeatureFlagEvents: this._resolveSendFeatureFlagEvents(options?.sendFeatureFlagEvents)
      });
      if (result === undefined)
        return;
      if (result.enabled === false)
        return false;
      const feat = result.variant ?? true;
      return !!feat || false;
    }
    async getAllFlags(distinctIdOrOptions, options) {
      const { distinctId: resolvedDistinctId, options: resolvedOptions } = this._resolveDistinctId(distinctIdOrOptions, options);
      if (!resolvedDistinctId) {
        this._logger.warn("[PostHog] distinctId is required to get feature flags — pass it explicitly or use withContext()");
        return {};
      }
      const response = await this.getAllFlagsAndPayloads(resolvedDistinctId, resolvedOptions);
      return response.featureFlags || {};
    }
    async getAllFlagsAndPayloads(distinctIdOrOptions, options) {
      const { distinctId: resolvedDistinctId, options: resolvedOptions } = this._resolveDistinctId(distinctIdOrOptions, options);
      if (!resolvedDistinctId) {
        this._logger.warn("[PostHog] distinctId is required to get feature flags and payloads — pass it explicitly or use withContext()");
        return {
          featureFlags: {},
          featureFlagPayloads: {}
        };
      }
      if (this.disabled) {
        this._logger.warn("The client is disabled");
        return {
          featureFlags: {},
          featureFlagPayloads: {}
        };
      }
      const { groups, disableGeoip, flagKeys } = resolvedOptions || {};
      let { onlyEvaluateLocally, personProperties, groupProperties } = resolvedOptions || {};
      const adjustedProperties = this.addLocalPersonAndGroupProperties(resolvedDistinctId, groups, personProperties, groupProperties);
      personProperties = adjustedProperties.allPersonProperties;
      groupProperties = adjustedProperties.allGroupProperties;
      const evaluationContext = this.createFeatureFlagEvaluationContext(resolvedDistinctId, groups, this.personPropertiesForLocalEvaluation(resolvedDistinctId, personProperties), groupProperties);
      if (onlyEvaluateLocally == undefined)
        onlyEvaluateLocally = this.options.strictLocalEvaluation ?? false;
      const localEvaluationResult = await this.featureFlagsPoller?.getAllFlagsAndPayloads(evaluationContext, flagKeys);
      let featureFlags = {};
      let featureFlagPayloads = {};
      let fallbackToFlags = true;
      if (localEvaluationResult) {
        featureFlags = localEvaluationResult.response;
        featureFlagPayloads = localEvaluationResult.payloads;
        fallbackToFlags = localEvaluationResult.fallbackToFlags;
      }
      if (fallbackToFlags && !onlyEvaluateLocally) {
        const remoteEvaluationResult = await super.getFeatureFlagsAndPayloadsStateless(evaluationContext.distinctId, evaluationContext.groups, personProperties, groupProperties, disableGeoip, flagKeys);
        featureFlags = {
          ...featureFlags,
          ...remoteEvaluationResult.flags || {}
        };
        featureFlagPayloads = {
          ...featureFlagPayloads,
          ...remoteEvaluationResult.payloads || {}
        };
      }
      if (this._flagOverrides !== undefined)
        featureFlags = {
          ...featureFlags,
          ...this._flagOverrides
        };
      if (this._payloadOverrides !== undefined)
        featureFlagPayloads = {
          ...featureFlagPayloads,
          ...this._payloadOverrides
        };
      return {
        featureFlags,
        featureFlagPayloads
      };
    }
    async evaluateFlags(distinctIdOrOptions, options) {
      const { distinctId: resolvedDistinctId, options: resolvedOptions } = this._resolveDistinctId(distinctIdOrOptions, options);
      if (!resolvedDistinctId) {
        this._logger.warn("[PostHog] distinctId is required to evaluate feature flags — pass it explicitly or use withContext()");
        return new FeatureFlagEvaluations({
          host: this._getFeatureFlagEvaluationsHost(),
          distinctId: "",
          flags: {}
        });
      }
      if (this.disabled) {
        this._logger.warn("The client is disabled");
        return new FeatureFlagEvaluations({
          host: this._getFeatureFlagEvaluationsHost(),
          distinctId: resolvedDistinctId,
          flags: {}
        });
      }
      const { groups, disableGeoip } = resolvedOptions || {};
      const flagKeys = resolvedOptions?.flagKeys ?? undefined;
      if (flagKeys?.length === 0)
        return new FeatureFlagEvaluations({
          host: this._getFeatureFlagEvaluationsHost(),
          distinctId: resolvedDistinctId,
          groups,
          disableGeoip,
          flags: {}
        });
      let { onlyEvaluateLocally, personProperties, groupProperties } = resolvedOptions || {};
      const adjustedProperties = this.addLocalPersonAndGroupProperties(resolvedDistinctId, groups, personProperties, groupProperties);
      personProperties = adjustedProperties.allPersonProperties;
      groupProperties = adjustedProperties.allGroupProperties;
      const evaluationContext = this.createFeatureFlagEvaluationContext(resolvedDistinctId, groups, this.personPropertiesForLocalEvaluation(resolvedDistinctId, personProperties), groupProperties);
      if (onlyEvaluateLocally == undefined)
        onlyEvaluateLocally = this.options.strictLocalEvaluation ?? false;
      const requestedFlagKeys = flagKeys ? new Set(flagKeys) : undefined;
      const records = {};
      let requestId;
      let evaluatedAt;
      let errorsWhileComputing = false;
      let quotaLimited = false;
      const localResult = await this.featureFlagsPoller?.getAllFlagsAndPayloads(evaluationContext, flagKeys);
      const locallyEvaluatedKeys = new Set;
      if (localResult)
        for (const [key, value] of Object.entries(localResult.response)) {
          const flagDef = this.featureFlagsPoller?.featureFlagsByKey[key];
          records[key] = {
            key,
            enabled: value !== false,
            variant: typeof value == "string" ? value : undefined,
            payload: localResult.payloads[key],
            id: flagDef?.id,
            version: undefined,
            reason: "Evaluated locally",
            locallyEvaluated: true,
            hasExperiment: flagDef?.has_experiment
          };
          locallyEvaluatedKeys.add(key);
        }
      const requestedFlagMissingLocally = requestedFlagKeys !== undefined && Array.from(requestedFlagKeys).some((key) => this.featureFlagsPoller?.featureFlagsByKey[key] === undefined);
      const fallbackToFlags = localResult ? localResult.fallbackToFlags || requestedFlagMissingLocally : true;
      if (fallbackToFlags && !onlyEvaluateLocally) {
        const details = await super.getFeatureFlagDetailsStateless(evaluationContext.distinctId, evaluationContext.groups, personProperties, groupProperties, disableGeoip, flagKeys);
        if (details) {
          this._minimalFlagCalledEvents = details.minimalFlagCalledEvents === true;
          requestId = details.requestId;
          evaluatedAt = details.evaluatedAt;
          errorsWhileComputing = Boolean(details.errorsWhileComputingFlags);
          quotaLimited = Array.isArray(details.quotaLimited) && details.quotaLimited.includes("feature_flags");
          for (const [key, detail] of Object.entries(details.flags)) {
            if (locallyEvaluatedKeys.has(key))
              continue;
            let parsedPayload;
            if (detail.metadata?.payload !== undefined)
              try {
                parsedPayload = JSON.parse(detail.metadata.payload);
              } catch {
                parsedPayload = detail.metadata.payload;
              }
            records[key] = {
              key,
              enabled: detail.enabled,
              variant: detail.variant,
              payload: parsedPayload,
              id: detail.metadata?.id,
              version: detail.metadata?.version,
              reason: detail.reason?.description ?? detail.reason?.code,
              locallyEvaluated: false,
              hasExperiment: detail.metadata?.has_experiment
            };
          }
        }
      }
      if (this._flagOverrides !== undefined)
        for (const [key, value] of Object.entries(this._flagOverrides)) {
          if (value === undefined) {
            delete records[key];
            continue;
          }
          const existing = records[key];
          records[key] = {
            key,
            enabled: value !== false,
            variant: typeof value == "string" ? value : undefined,
            payload: existing?.payload,
            id: existing?.id,
            version: existing?.version,
            reason: existing?.reason,
            locallyEvaluated: existing?.locallyEvaluated ?? false,
            hasExperiment: existing?.hasExperiment
          };
        }
      if (this._payloadOverrides !== undefined)
        for (const [key, payload] of Object.entries(this._payloadOverrides)) {
          const existing = records[key];
          if (existing)
            records[key] = {
              ...existing,
              payload
            };
        }
      if (requestedFlagKeys !== undefined) {
        for (const key of Object.keys(records))
          if (!requestedFlagKeys.has(key))
            delete records[key];
      }
      const unresolvedFlags = {};
      for (const [key, reason] of Object.entries(localResult?.unresolved ?? {}))
        if (!Object.prototype.hasOwnProperty.call(records, key))
          unresolvedFlags[key] = reason;
      return new FeatureFlagEvaluations({
        host: this._getFeatureFlagEvaluationsHost(),
        distinctId: resolvedDistinctId,
        groups,
        disableGeoip,
        flags: records,
        unresolvedFlags,
        requestId,
        evaluatedAt,
        flagDefinitionsLoadedAt: this.featureFlagsPoller?.getFlagDefinitionsLoadedAt(),
        errorsWhileComputing,
        quotaLimited
      });
    }
    _shouldSendMinimalFlagCalledEvent(event, properties) {
      return event === "$feature_flag_called" && this._minimalFlagCalledEvents && properties.$feature_flag_has_experiment === false;
    }
    _captureFlagCalledEventIfNeeded(params) {
      const { distinctId, key, response, groups, disableGeoip, properties } = params;
      const groupSuffix = groups && Object.keys(groups).length > 0 ? `_${JSON.stringify(Object.entries(groups).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))}` : "";
      const featureFlagReportedKey = `${key}_${response}${groupSuffix}`;
      const reported = this._distinctIdHasSentFlagCalls.get(distinctId) ?? new Set;
      this._distinctIdHasSentFlagCalls.delete(distinctId);
      this._distinctIdHasSentFlagCalls.set(distinctId, reported);
      if (reported.has(featureFlagReportedKey))
        return;
      reported.add(featureFlagReportedKey);
      while (this._distinctIdHasSentFlagCalls.size > Math.max(this.maxCacheSize, 1)) {
        const lruDistinctId = this._distinctIdHasSentFlagCalls.keys().next().value;
        if (lruDistinctId === undefined)
          break;
        this._distinctIdHasSentFlagCalls.delete(lruDistinctId);
      }
      this.capture({
        distinctId,
        event: "$feature_flag_called",
        properties,
        groups,
        disableGeoip
      });
    }
    _resolveSendFeatureFlagEvents(perCall) {
      return perCall ?? this.options.sendFeatureFlagEvent ?? true;
    }
    _getFeatureFlagEvaluationsHost() {
      if (!this._featureFlagEvaluationsHost)
        this._featureFlagEvaluationsHost = {
          captureFlagCalledEventIfNeeded: (params) => this._captureFlagCalledEventIfNeeded(params),
          resolveSendFeatureFlagEvents: (perRead) => this._resolveSendFeatureFlagEvents(perRead),
          logWarning: (message) => {
            if (this.options.featureFlagsLogWarnings !== false)
              console.warn(`[PostHog] ${message}`);
          }
        };
      return this._featureFlagEvaluationsHost;
    }
    groupIdentify({ groupType, groupKey, properties, distinctId, disableGeoip }) {
      this._sendPreparedEvent("capture", {
        distinctId: distinctId || `$${groupType}_${groupKey}`,
        event: "$groupidentify",
        properties: {
          $group_type: groupType,
          $group_key: groupKey,
          $group_set: properties || {}
        },
        disableGeoip
      }, false, {
        includeContextProperties: false
      });
    }
    async groupIdentifyImmediate({ groupType, groupKey, properties, distinctId, disableGeoip }) {
      await this._sendPreparedEvent("capture", {
        distinctId: distinctId || `$${groupType}_${groupKey}`,
        event: "$groupidentify",
        properties: {
          $group_type: groupType,
          $group_key: groupKey,
          $group_set: properties || {}
        },
        disableGeoip
      }, true, {
        includeContextProperties: false
      });
    }
    async reloadFeatureFlags() {
      await this.featureFlagsPoller?.loadFeatureFlags(true);
    }
    overrideFeatureFlags(overrides) {
      const flagArrayToRecord = (flags) => Object.fromEntries(flags.map((f) => [
        f,
        true
      ]));
      if (overrides === false) {
        this._flagOverrides = undefined;
        this._payloadOverrides = undefined;
        return;
      }
      if (Array.isArray(overrides)) {
        this._flagOverrides = flagArrayToRecord(overrides);
        return;
      }
      if (this._isFeatureFlagOverrideOptions(overrides)) {
        if ("flags" in overrides) {
          if (overrides.flags === false)
            this._flagOverrides = undefined;
          else if (Array.isArray(overrides.flags))
            this._flagOverrides = flagArrayToRecord(overrides.flags);
          else if (overrides.flags !== undefined)
            this._flagOverrides = {
              ...overrides.flags
            };
        }
        if ("payloads" in overrides) {
          if (overrides.payloads === false)
            this._payloadOverrides = undefined;
          else if (overrides.payloads !== undefined)
            this._payloadOverrides = {
              ...overrides.payloads
            };
        }
        return;
      }
      this._flagOverrides = {
        ...overrides
      };
    }
    _isFeatureFlagOverrideOptions(overrides) {
      if (typeof overrides != "object" || overrides === null || Array.isArray(overrides))
        return false;
      const obj = overrides;
      if ("flags" in obj) {
        const flagsValue = obj["flags"];
        if (flagsValue === false || Array.isArray(flagsValue) || typeof flagsValue == "object" && flagsValue !== null)
          return true;
      }
      if ("payloads" in obj) {
        const payloadsValue = obj["payloads"];
        if (payloadsValue === false || typeof payloadsValue == "object" && payloadsValue !== null)
          return true;
      }
      return false;
    }
    withContext(data, fn, options) {
      if (!this.context)
        return fn();
      return this.context.run(data, () => {
        notifyContextListeners(this);
        return fn();
      }, options);
    }
    getContext() {
      return this.context?.get();
    }
    enterContext(data, options) {
      this.context?.enter(data, options);
      notifyContextListeners(this);
    }
    async _shutdown(shutdownTimeoutMs) {
      const shutdownDeadlineMs = Date.now() + (shutdownTimeoutMs ?? 30000);
      this._isShutdown = true;
      const emailsDrained = this._emails?.drain();
      const resolve = this._consumeWaitUntilCycle();
      await this.featureFlagsPoller?.stopPoller(shutdownTimeoutMs);
      this.errorTracking.shutdown();
      if (this._metrics) {
        await raceWithTimeout(this._metrics.flush().catch(() => {}), Math.max(0, shutdownDeadlineMs - Date.now()));
        this._metrics.reset();
      }
      if (this._traces) {
        await raceWithTimeout(this._traces.flush().catch(() => {}), Math.max(0, shutdownDeadlineMs - Date.now()));
        this._traces.reset();
      }
      const remainingMs = Math.max(0, shutdownDeadlineMs - Date.now());
      const emailsSettled = emailsDrained ? raceWithTimeout(emailsDrained, remainingMs) : undefined;
      try {
        return await super._shutdown(remainingMs);
      } finally {
        await emailsSettled;
        this._distinctIdHasSentFlagCalls.clear();
        resolve?.();
      }
    }
    async _requestRemoteConfigPayload(flagKey) {
      if (this.disabled || !this.apiKey || !this.options.personalApiKey)
        return;
      const url = `${this.host}/api/projects/@current/feature_flags/${flagKey}/remote_config?token=${encodeURIComponent(this.apiKey)}`;
      const options = {
        method: "GET",
        headers: {
          ...this.getCustomHeaders(),
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.personalApiKey}`
        }
      };
      let abortTimeout = null;
      if (this.options.requestTimeout && typeof this.options.requestTimeout == "number") {
        const controller = new AbortController;
        abortTimeout = safeSetTimeout(() => {
          controller.abort();
        }, this.options.requestTimeout);
        options.signal = controller.signal;
      }
      try {
        return await this.fetch(url, options);
      } catch (error) {
        this._events.emit("error", error);
        return;
      } finally {
        if (abortTimeout)
          clearTimeout(abortTimeout);
      }
    }
    extractPropertiesFromEvent(eventProperties, groups) {
      if (!eventProperties)
        return {
          personProperties: {},
          groupProperties: {}
        };
      const personProperties = {};
      const groupProperties = {};
      for (const [key, value] of Object.entries(eventProperties))
        if (isPlainObject2(value) && groups && key in groups) {
          const groupProps = {};
          for (const [groupKey, groupValue] of Object.entries(value))
            groupProps[String(groupKey)] = String(groupValue);
          groupProperties[String(key)] = groupProps;
        } else
          personProperties[String(key)] = String(value);
      return {
        personProperties,
        groupProperties
      };
    }
    async getFeatureFlagsForEvent(distinctId, groups, disableGeoip, sendFeatureFlagsOptions) {
      if (this.disabled || !this.apiKey)
        return void this._logger.warn("The client is disabled");
      const finalPersonProperties = sendFeatureFlagsOptions?.personProperties || {};
      const finalGroupProperties = sendFeatureFlagsOptions?.groupProperties || {};
      const flagKeys = sendFeatureFlagsOptions?.flagKeys;
      const onlyEvaluateLocally = sendFeatureFlagsOptions?.onlyEvaluateLocally ?? this.options.strictLocalEvaluation ?? false;
      if (onlyEvaluateLocally)
        if (!((this.featureFlagsPoller?.featureFlags?.length || 0) > 0))
          return {};
        else {
          const groupsWithStringValues = {};
          for (const [key, value] of Object.entries(groups || {}))
            groupsWithStringValues[key] = String(value);
          return await this.getAllFlags(distinctId, {
            groups: groupsWithStringValues,
            personProperties: finalPersonProperties,
            groupProperties: finalGroupProperties,
            disableGeoip,
            onlyEvaluateLocally: true,
            flagKeys
          });
        }
      if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
        const groupsWithStringValues = {};
        for (const [key, value] of Object.entries(groups || {}))
          groupsWithStringValues[key] = String(value);
        return await this.getAllFlags(distinctId, {
          groups: groupsWithStringValues,
          personProperties: finalPersonProperties,
          groupProperties: finalGroupProperties,
          disableGeoip,
          onlyEvaluateLocally: true,
          flagKeys
        });
      }
      return (await super.getFeatureFlagsStateless(distinctId, groups, finalPersonProperties, finalGroupProperties, disableGeoip)).flags;
    }
    addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties) {
      const allPersonProperties = {
        ...personProperties || {}
      };
      const allGroupProperties = {};
      if (groups)
        for (const groupName of Object.keys(groups))
          allGroupProperties[groupName] = {
            $group_key: groups[groupName],
            ...groupProperties?.[groupName] || {}
          };
      return {
        allPersonProperties,
        allGroupProperties
      };
    }
    personPropertiesForLocalEvaluation(distinctId, personProperties) {
      return {
        distinct_id: distinctId,
        ...personProperties || {}
      };
    }
    createFeatureFlagEvaluationContext(distinctId, groups, personProperties, groupProperties) {
      return {
        distinctId,
        groups: groups || {},
        personProperties: personProperties || {},
        groupProperties: groupProperties || {},
        evaluationCache: {}
      };
    }
    captureException(error, distinctId, additionalProperties, uuid, flags) {
      if (!error_tracking_default.isPreviouslyCapturedError(error) && this.errorTracking.claimExplicitCapture(error)) {
        const syntheticException = new Error("PostHog syntheticException");
        this.addPendingPromise(error_tracking_default.buildEventMessage(this.getErrorPropertiesBuilder(), error, {
          syntheticException
        }, distinctId, additionalProperties, this.getContext()).then((msg) => this._capturePreparedEvent({
          ...msg,
          uuid,
          flags
        }, false)));
      }
    }
    async captureExceptionImmediate(error, distinctId, additionalProperties, flags) {
      if (!error_tracking_default.isPreviouslyCapturedError(error) && this.errorTracking.claimExplicitCapture(error)) {
        const syntheticException = new Error("PostHog syntheticException");
        return this.addPendingPromise(error_tracking_default.buildEventMessage(this.getErrorPropertiesBuilder(), error, {
          syntheticException
        }, distinctId, additionalProperties, this.getContext()).then((msg) => this.captureImmediate({
          ...msg,
          flags
        })));
      }
    }
    async prepareEventMessage(props) {
      return this._prepareEventMessage(props);
    }
    async _prepareEventMessage(props, options = {}) {
      const { distinctId, event, properties, groups, flags, sendFeatureFlags, timestamp, disableGeoip, uuid } = props;
      const contextData = getEventContext(props, this.context?.get());
      const includeContextProperties = options.includeContextProperties ?? true;
      let mergedDistinctId = distinctId || contextData?.distinctId;
      const mergedProperties = includeContextProperties ? {
        ...this.props,
        ...contextData?.properties || {},
        ...properties || {}
      } : {
        ...properties || {}
      };
      if (event === "$exception" && !(("$trace_id" in mergedProperties) || ("$span_id" in mergedProperties)))
        Object.assign(mergedProperties, await getActiveTraceProperties());
      if (!mergedDistinctId) {
        mergedDistinctId = uuidv7();
        mergedProperties.$process_person_profile = false;
      }
      if (includeContextProperties && contextData?.sessionId && !mergedProperties.$session_id)
        mergedProperties.$session_id = contextData.sessionId;
      const finalProperties = this._shouldSendMinimalFlagCalledEvent(event, mergedProperties) ? minimizeFlagCalledEventProperties(mergedProperties) : mergedProperties;
      const eventMessage = this._runBeforeSend({
        distinctId: mergedDistinctId,
        event,
        properties: finalProperties,
        groups,
        flags,
        sendFeatureFlags,
        timestamp,
        disableGeoip,
        uuid
      });
      if (!eventMessage)
        return Promise.reject(null);
      const eventProperties = await Promise.resolve().then(async () => {
        if (flags) {
          if (sendFeatureFlags)
            console.warn("[PostHog] Both `flags` and `sendFeatureFlags` were passed to capture(); using `flags` and ignoring `sendFeatureFlags`.");
          return flags._getEventProperties();
        }
        if (sendFeatureFlags) {
          emitDeprecationWarningOnce("sendFeatureFlags", "`sendFeatureFlags` is deprecated and will be removed in a future major version. Pass a `flags` snapshot from `posthog.evaluateFlags(...)` instead — it avoids a second `/flags` request per capture and guarantees the event carries the exact flag values your code branched on.");
          const sendFeatureFlagsOptions = typeof sendFeatureFlags == "object" ? sendFeatureFlags : undefined;
          const flagValues = await this.getFeatureFlagsForEvent(eventMessage.distinctId, groups, disableGeoip, sendFeatureFlagsOptions);
          return buildFlagEventProperties(flagValues);
        }
        return {};
      }).catch(() => ({})).then((additionalProperties) => {
        const resolvedGroups = eventMessage.groups || groups;
        return {
          ...additionalProperties,
          ...eventMessage.properties || {},
          ...resolvedGroups !== undefined && Object.keys(resolvedGroups).length > 0 ? {
            $groups: resolvedGroups
          } : {}
        };
      });
      if (eventMessage.event === "$pageview" && this.options.__preview_capture_bot_pageviews && typeof eventProperties.$raw_user_agent == "string") {
        if (isBlockedUA(eventProperties.$raw_user_agent, this.options.custom_blocked_useragents || [])) {
          eventMessage.event = "$bot_pageview";
          eventProperties.$browser_type = "bot";
        }
      }
      return {
        distinctId: eventMessage.distinctId,
        event: eventMessage.event,
        properties: eventProperties,
        options: {
          timestamp: eventMessage.timestamp,
          disableGeoip: eventMessage.disableGeoip,
          uuid: eventMessage.uuid
        }
      };
    }
    _runBeforeSend(eventMessage) {
      const beforeSend = this.options.before_send;
      if (!beforeSend)
        return eventMessage;
      const fns = Array.isArray(beforeSend) ? beforeSend : [
        beforeSend
      ];
      let result = eventMessage;
      for (const fn of fns)
        try {
          result = fn(result);
          if (!result) {
            this._logger.info(`Event '${eventMessage.event}' was rejected in beforeSend function`);
            return null;
          }
          if (!result.properties || Object.keys(result.properties).length === 0) {
            const message = `Event '${result.event}' has no properties after beforeSend function, this is likely an error.`;
            this._logger.warn(message);
          }
        } catch (error) {
          this._logger.error(`Error in before_send function for event '${eventMessage.event}':`, error);
          return null;
        }
      return result;
    }
  };
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/context/lifetime.mjs
function inheritContextLifetime(parent, child, signal) {
  const lifetime = parent && lifetimes.get(parent);
  if (signal)
    lifetimes.set(child, {
      signal,
      parent: lifetime
    });
  else if (lifetime)
    lifetimes.set(child, lifetime);
  return child;
}
function isContextActive(context) {
  let lifetime = lifetimes.get(context);
  while (lifetime) {
    if (lifetime.signal.aborted)
      return false;
    lifetime = lifetime.parent;
  }
  return true;
}
var lifetimes;
var init_lifetime = __esm(() => {
  lifetimes = new WeakMap;
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/context/context.mjs
import { AsyncLocalStorage } from "node:async_hooks";

class PostHogContext {
  constructor() {
    this.storage = new AsyncLocalStorage;
  }
  get() {
    const context = this.storage.getStore();
    return context && isContextActive(context) ? context : undefined;
  }
  run(context, fn, options) {
    return this.storage.run(this.resolve(context, options), fn);
  }
  enter(context, options) {
    this.storage.enterWith(this.resolve(context, options));
  }
  resolve(context, options) {
    const current = this.get();
    if (options?.fresh === true)
      return inheritContextLifetime(undefined, {
        ...context
      }, options.signal);
    return inheritContextLifetime(current, {
      distinctId: context.distinctId ?? current?.distinctId,
      sessionId: context.sessionId ?? current?.sessionId,
      properties: {
        ...current?.properties || {},
        ...context.properties || {}
      }
    }, options?.signal);
  }
}
var init_context2 = __esm(() => {
  init_lifetime();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/context/span-context.node.mjs
import { AsyncLocalStorage as AsyncLocalStorage2 } from "node:async_hooks";

class AsyncLocalStorageSpanContextManager {
  active() {
    return this._storage.getStore();
  }
  with(span, fn) {
    return this._storage.run(span, fn);
  }
  constructor() {
    this._storage = new AsyncLocalStorage2;
  }
}
var init_span_context_node = () => {};

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/gzip.node.mjs
import { gzip } from "node:zlib";
import { promisify } from "node:util";
async function gzipCompress2(input, isDebug = true) {
  try {
    const compressed = await gzipAsync(input);
    return new Uint8Array(compressed);
  } catch (error) {
    if (isDebug)
      console.error("Failed to gzip compress data", error);
    return null;
  }
}
var gzipAsync;
var init_gzip_node = __esm(() => {
  gzipAsync = promisify(gzip);
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/host-os.node.mjs
import { platform as platform2, release as release3 } from "node:os";
function hostOsResourceAttributes() {
  let osName;
  let osVersion;
  try {
    osName = platform2();
    osVersion = release3();
  } catch {}
  return osResourceAttributes(osName, osVersion);
}
var init_host_os_node = __esm(() => {
  init_dist();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/sentry-integration.mjs
function createEventProcessor(_posthog, { organization, projectId, prefix, severityAllowList = [
  "error"
], sendExceptionsToPostHog = true } = {}) {
  return (event) => {
    const shouldProcessLevel = severityAllowList === "*" || severityAllowList.includes(event.level);
    if (!shouldProcessLevel)
      return event;
    if (!event.tags)
      event.tags = {};
    const userId = event.tags[PostHogSentryIntegration.POSTHOG_ID_TAG];
    if (userId === undefined)
      return event;
    const uiHost = _posthog.options.host ?? "https://us.i.posthog.com";
    const personUrl = new URL(`/project/${_posthog.apiKey}/person/${userId}`, uiHost).toString();
    event.tags["PostHog Person URL"] = personUrl;
    const exceptions = event.exception?.values || [];
    const exceptionList = exceptions.map((exception) => ({
      ...exception,
      stacktrace: exception.stacktrace ? {
        ...exception.stacktrace,
        type: "raw",
        frames: (exception.stacktrace.frames || []).map((frame) => ({
          ...frame,
          platform: "node:javascript"
        }))
      } : undefined
    }));
    const properties = {
      $exception_message: exceptions[0]?.value || event.message,
      $exception_type: exceptions[0]?.type,
      $exception_level: event.level,
      $exception_list: exceptionList,
      $sentry_event_id: event.event_id,
      $sentry_exception: event.exception,
      $sentry_exception_message: exceptions[0]?.value || event.message,
      $sentry_exception_type: exceptions[0]?.type,
      $sentry_tags: event.tags
    };
    const injectedReleaseId = getInjectedReleaseId();
    if (injectedReleaseId)
      properties.$release_id = injectedReleaseId;
    if (organization && projectId)
      properties["$sentry_url"] = (prefix || "https://sentry.io/organizations/") + organization + "/issues/?project=" + projectId + "&query=" + event.event_id;
    if (sendExceptionsToPostHog)
      _posthog.capture({
        event: "$exception",
        distinctId: userId,
        properties
      });
    return event;
  };
}
var NAME = "posthog-node", PostHogSentryIntegration;
var init_sentry_integration = __esm(() => {
  init_dist();
  PostHogSentryIntegration = class PostHogSentryIntegration {
    static {
      this.POSTHOG_ID_TAG = "posthog_distinct_id";
    }
    constructor(_posthog, organization, prefix, severityAllowList, sendExceptionsToPostHog) {
      this.name = NAME;
      this.name = NAME;
      this.setupOnce = function(addGlobalEventProcessor, getCurrentHub) {
        const projectId = getCurrentHub()?.getClient()?.getDsn()?.projectId;
        addGlobalEventProcessor(createEventProcessor(_posthog, {
          organization,
          projectId,
          prefix,
          severityAllowList,
          sendExceptionsToPostHog: sendExceptionsToPostHog ?? true
        }));
      };
    }
  };
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/tracing-headers.mjs
var init_tracing_headers2 = __esm(() => {
  init_dist();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/url-utils.mjs
var init_url_utils = __esm(() => {
  init_dist();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/extensions/express.mjs
var init_express = __esm(() => {
  init_error_tracking2();
  init_tracing_headers2();
  init_url_utils();
  init_listeners();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/exports.mjs
var init_exports = __esm(() => {
  init_listeners();
  init_feature_flag_evaluations();
  init_errors4();
  init_dist();
  init_sentry_integration();
  init_express();
  init_types3();
});

// ../../node_modules/.bun/posthog-node@5.63.1+e40b0dfdd726a224/node_modules/posthog-node/dist/entrypoints/index.node.mjs
var PostHog;
var init_index_node = __esm(() => {
  init_module_node();
  init_context_lines_node();
  init_relative_path_node();
  init_client2();
  init_dist();
  init_context2();
  init_span_context_node();
  init_gzip_node();
  init_host_os_node();
  init_exports();
  PostHog = class PostHog extends PostHogBackendClient {
    getLibraryId() {
      return "posthog-node";
    }
    compressPayload(payload) {
      return gzipCompress2(payload, this.isDebug);
    }
    initializeContext() {
      return new PostHogContext;
    }
    initializeSpanContextManager() {
      return new AsyncLocalStorageSpanContextManager;
    }
    hostResourceAttributes() {
      return hostOsResourceAttributes();
    }
    createErrorPropertiesBuilder() {
      return new ErrorPropertiesBuilder([
        new EventCoercer,
        new ErrorCoercer,
        new ObjectCoercer,
        new StringCoercer,
        new PrimitiveCoercer
      ], createStackParser("node:javascript", nodeStackLineParser), [
        createModulerModifier(),
        (frames) => addSourceContext(frames, undefined, this._logger),
        createRelativePathModifier()
      ]);
    }
  };
});

// ../../packages/analytics/src/plugin/posthog.ts
class PostHogServerProvider {
  posthog;
  defaultProperties;
  constructor(apiKey, apiHost, defaultProperties) {
    this.posthog = new PostHog(apiKey, {
      host: apiHost || "https://us.i.posthog.com",
      disableGeoip: false
    });
    this.defaultProperties = defaultProperties ?? {};
  }
  set(collection, objectId, properties) {
    if (collection === "users") {
      this.posthog.identify({
        distinctId: objectId,
        properties: { ...this.defaultProperties, ...properties }
      });
    }
  }
  event(_collection, objectId, eventName, properties, context) {
    this.posthog.capture({
      distinctId: objectId,
      event: eventName,
      properties: { ...this.defaultProperties, ...properties, ...context }
    });
  }
  captureException(error, distinctId, context) {
    this.posthog.captureException(error, distinctId, {
      ...this.defaultProperties,
      ...context
    });
  }
  getFeatureFlag(key, distinctId) {
    return this.posthog.getFeatureFlag(key, distinctId);
  }
  async dispose() {
    await this.posthog.shutdown();
  }
}
var init_posthog = __esm(() => {
  init_index_node();
});

// ../../packages/analytics/src/plugin/identity.ts
function resolveIdentity(userId, fallbackId, properties) {
  if (userId) {
    return { distinctId: userId, properties };
  }
  return {
    distinctId: fallbackId,
    properties: { ...properties, [PROCESS_PERSON_PROFILE]: false }
  };
}
function resolveExceptionIdentity(userId, anonymousId, properties = {}) {
  return resolveIdentity(userId, anonymousId || UNKNOWN_INSTALL_ID, properties);
}
var PROCESS_PERSON_PROFILE = "$process_person_profile", UNKNOWN_INSTALL_ID = "unknown-install";

// ../../packages/analytics/src/plugin/node.ts
function createServerAnalytics(configOrApiKey, legacyOptions) {
  if (typeof configOrApiKey === "string") {
    return new Analytics([
      new PostHogServerProvider(configOrApiKey, undefined, legacyOptions?.defaultProperties)
    ]);
  }
  const explicit = configOrApiKey ?? {};
  const apiKey = explicit.posthog?.apiKey ?? env().POSTHOG_API_KEY;
  if (!apiKey)
    return new Analytics([]);
  return new Analytics([
    new PostHogServerProvider(apiKey, explicit.posthog?.apiHost, explicit.defaultProperties)
  ]);
}
var env = () => globalThis.process?.env ?? {};
var init_node2 = __esm(() => {
  init_posthog();
});

// ../../packages/analytics/src/server.ts
var logged;
var init_server = __esm(() => {
  init_node2();
  logged = new Set;
});

// ../../packages/plugin-common/src/analytics/index.ts
function createAnalyticsClient(config) {
  const { posthogApiKey, errorSourcePrefix, anonymousId, logger } = config;
  if (!posthogApiKey) {
    return null;
  }
  const client = createServerAnalytics(posthogApiKey);
  return {
    captureException(error, errorType, errorSource, userId, properties) {
      try {
        const context = {
          error_type: errorType,
          error_category: getErrorCategory(errorType),
          error_source: `${errorSourcePrefix}/${errorSource}`,
          ...properties
        };
        const identity = resolveExceptionIdentity(userId, anonymousId, context);
        client.captureException(error, identity.distinctId, identity.properties);
      } catch (e) {
        logger?.debug("Failed to capture exception in PostHog", e);
      }
    },
    capture(distinctId, eventName, properties) {
      try {
        client.track({
          distinctId,
          event: eventName,
          properties
        });
      } catch (e) {
        logger?.debug("Failed to capture event in PostHog", e);
      }
    },
    async shutdown() {
      try {
        await client.dispose();
      } catch (e) {
        logger?.debug("Error shutting down analytics", e);
      }
    }
  };
}
var init_analytics = __esm(() => {
  init_server();
  init_events();
  init_events();
});

// ../../packages/plugin-common/src/analytics/plugin-analytics.ts
function createPluginAnalytics(config) {
  const { logger, getPluginVersion } = config;
  let analyticsClient = null;
  async function getAnalyticsClient() {
    if (!config.posthogApiKey)
      return null;
    if (!analyticsClient) {
      analyticsClient = createAnalyticsClient({
        posthogApiKey: config.posthogApiKey,
        errorSourcePrefix: config.errorSourcePrefix,
        anonymousId: getAnonymousId(config.stateDir),
        logger
      });
    }
    return analyticsClient;
  }
  async function resolveSession(load = config.loadSession) {
    try {
      return await load();
    } catch (error) {
      logger.debug("Could not load session for analytics context", error);
      return null;
    }
  }
  function enrichProperties(session, extra) {
    return {
      ...buildStandardProperties(getPluginVersion()),
      ...buildUserProperties(session),
      ...extra
    };
  }
  async function captureException(error, errorType, errorSource, additionalProperties) {
    try {
      const client = await getAnalyticsClient();
      if (!client)
        return;
      const session = await resolveSession();
      client.captureException(error, errorType, errorSource, session?.userId, enrichProperties(session, additionalProperties));
    } catch (e) {
      logger.debug("Failed to capture exception in PostHog", e);
    }
  }
  async function shutdownAnalytics() {
    try {
      if (analyticsClient) {
        await analyticsClient.shutdown();
        analyticsClient = null;
      }
    } catch (error) {
      logger.debug("Error shutting down analytics client", error);
    }
  }
  return { captureException, shutdownAnalytics, resolveSession, enrichProperties };
}
var init_plugin_analytics = __esm(() => {
  init_anonymous_id();
  init_analytics();
  init_properties();
});

// ../../packages/plugin-common/src/runtime/plugin-runtime.ts
import { readFileSync as readFileSync4 } from "node:fs";
import { join as join7 } from "node:path";
function pluginStatePaths(root) {
  const queueDir = join7(root, "queue");
  return {
    root,
    queueDir,
    stateDir: join7(root, "state"),
    logsDir: join7(root, "logs"),
    settingsFile: join7(root, "settings.json"),
    sessionsQueueFile: join7(queueDir, "chat-sessions.jsonl"),
    messagesQueueFile: join7(queueDir, "chat-messages.jsonl"),
    statusCacheFile: join7(root, "status-cache.json"),
    syncMetricsFile: join7(root, "sync-metrics.jsonl"),
    initialSyncFile: join7(root, "initial-sync.json"),
    runtimeEnvFile: join7(root, "runtime.env")
  };
}
function createPluginRuntime(config) {
  const paths = pluginStatePaths(config.root);
  const { privacyManager, minMessagesPerSession } = config;
  const { cleanupStaleLogs, forceCleanupStaleLogs } = createLogRotation({
    logsDir: paths.logsDir,
    retentionDays: LOG_RETENTION_DAYS
  });
  const datedLogPath = (logPrefix) => getDatedLogPath(paths.logsDir, logPrefix);
  const { logger, flushLogs } = createLogger({
    prefix: config.logPrefix,
    logRotation: { getDatedLogPath: datedLogPath, cleanupStaleLogs },
    console: config.logToConsole ?? true
  });
  function getPluginVersion() {
    const baked = "2.0.0";
    if (baked)
      return baked;
    if (!config.packageJson)
      return "unknown";
    try {
      const pkg = JSON.parse(readFileSync4(config.packageJson(), "utf-8"));
      return typeof pkg.version === "string" ? pkg.version : "unknown";
    } catch (error) {
      logger.warn("Failed to read plugin version from package.json", error);
      return "unknown";
    }
  }
  const zest = createZestClient({
    clientId: config.clientId,
    version: getPluginVersion,
    logger,
    stateDir: config.root,
    agentKey: config.agentKey,
    openBrowser: config.openBrowser
  });
  let analytics;
  async function captureException(error, errorType, errorSource, additionalProperties) {
    if (!config.posthogApiKey)
      return;
    try {
      analytics ??= Promise.resolve().then(() => (init_plugin_analytics(), {})).then(({}) => createPluginAnalytics({
        posthogApiKey: config.posthogApiKey ?? "",
        errorSourcePrefix: `${config.clientId}-plugin`,
        stateDir: paths.stateDir,
        logger,
        getPluginVersion,
        loadSession: () => zest.auth.identity()
      }));
      await (await analytics).captureException(error, errorType, errorSource, additionalProperties);
    } catch (e) {
      logger.debug("Failed to capture exception in PostHog", e);
    }
  }
  async function shutdownAnalytics() {
    await analytics?.then((loaded) => loaded.shutdownAnalytics(), (error) => logger.debug("Analytics never loaded; nothing to shut down", error));
  }
  const fileLock = createFileLock({
    logger,
    onCaptureException: captureException,
    lockMaxRetries: config.lockMaxRetries,
    lockDir: paths.queueDir
  });
  const { withFileLock } = fileLock;
  const queue = createQueueManager({
    queueDir: paths.queueDir,
    queueFiles: { sessions: paths.sessionsQueueFile, messages: paths.messagesQueueFile },
    minMessagesPerSession,
    logger,
    privacyManager,
    withFileLock,
    onCaptureException: captureException,
    maxQueueSize: config.capQueue === false ? undefined : new Map([
      [paths.sessionsQueueFile, MAX_QUEUE_SIZE_SESSIONS],
      [paths.messagesQueueFile, MAX_QUEUE_SIZE_MESSAGES]
    ])
  });
  const statusCache = createStatusCacheManager({
    statusCacheFile: paths.statusCacheFile,
    logger,
    withFileLock,
    notificationDurationMs: config.notificationDurationMs ?? NOTIFICATION_DURATION_MS,
    standupNotificationThrottleMs: STANDUP_NOTIFICATION_THROTTLE_MS
  });
  const syncMetrics = createSyncMetricsManager({
    metricsFile: paths.syncMetricsFile,
    retentionMs: SYNC_METRICS_RETENTION_MS,
    logger,
    withFileLock
  });
  const runtimeEnv = createRuntimeEnv({ file: paths.runtimeEnvFile });
  return {
    paths,
    logger,
    flushLogs,
    getDatedLogPath: datedLogPath,
    cleanupStaleLogs,
    forceCleanupStaleLogs,
    getPluginVersion,
    zest,
    captureException,
    shutdownAnalytics,
    privacyManager,
    minMessagesPerSession,
    ...fileLock,
    ...queue,
    ...statusCache,
    ...syncMetrics,
    ...runtimeEnv
  };
}
function createPluginUpload(runtime, config) {
  const { logger, zest, privacyManager, captureException } = runtime;
  const uploader = createChatUploader({
    zest,
    scopeSessionIdsToUser: config.scopeSessionIdsToUser,
    sessionsQueueFile: runtime.paths.sessionsQueueFile,
    messagesQueueFile: runtime.paths.messagesQueueFile,
    platform: config.platform,
    source: config.source,
    sessionNamespace: config.sessionNamespace,
    minMessagesPerSession: runtime.minMessagesPerSession,
    staleSessionAgeMs: STALE_SESSION_AGE_MS,
    logger,
    readQueue: runtime.readQueue,
    atomicUpdateQueue: runtime.atomicUpdateQueue,
    onCaptureException: captureException,
    readSessionSignals: config.readSessionSignals,
    privacyManager
  });
  const syncQueued = createSyncQueued({
    logger,
    privacyManager,
    zest,
    uploader,
    loadSettings: config.loadSettings,
    getQueueStats: runtime.getQueueStats,
    recordSyncMetric: runtime.recordSyncMetric,
    clearSyncError: config.clearSyncError ?? runtime.clearSyncError,
    writeSyncStatus: runtime.writeSyncStatus,
    readSyncStatus: () => {
      const { lastSuccessAt, stuckAlertedAt } = runtime.readStatusCache().syncStatus;
      return { lastSuccessAt, stuckAlertedAt: stuckAlertedAt ?? null };
    },
    markStuckAlerted: runtime.markStuckAlerted,
    onCaptureException: captureException,
    circuitBreaker: config.circuitBreaker,
    loginCommand: config.loginCommand
  });
  return { uploader, getIdentityStats: uploader.getIdentityStats, syncQueued };
}
var LOG_RETENTION_DAYS = 7, SYNC_METRICS_RETENTION_MS, STANDUP_NOTIFICATION_THROTTLE_MS, NOTIFICATION_DURATION_MS, STALE_SESSION_AGE_MS, MAX_QUEUE_SIZE_SESSIONS = 500, MAX_QUEUE_SIZE_MESSAGES = 1e4;
var init_plugin_runtime = __esm(() => {
  init_status_cache_manager();
  init_uploader();
  init_log_rotation();
  init_logger();
  init_sync_metrics_manager();
  init_queue_manager();
  init_sync_queued();
  init_file_lock();
  init_zest();
  init_runtime_env();
  SYNC_METRICS_RETENTION_MS = 60 * 60 * 1000;
  STANDUP_NOTIFICATION_THROTTLE_MS = 2 * 60 * 60 * 1000;
  NOTIFICATION_DURATION_MS = 5 * 60 * 1000;
  STALE_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
});

// src/config/constants.ts
import { homedir } from "node:os";
import { join as join8 } from "node:path";
function getFreebuffConfigDir() {
  return process.env.FREEBUFF_CONFIG_DIR || join8(homedir(), ".config", "manicode");
}
function getFreebuffProjectsDir() {
  return join8(getFreebuffConfigDir(), "projects");
}
var FREEBUFF_CHAT_MESSAGES_FILE = "chat-messages.json", FREEBUFF_RUN_STATE_FILE = "run-state.json", AGENTS_DIR, AGENT_LOADER_FILE, FREEBUFF_ZEST_DIR, QUEUE_DIR, STATE_DIR, LOGS_DIR, SETTINGS_FILE, MESSAGES_QUEUE_FILE, SYNC_LOCK_FILE, INSTALLED_CLI_FILE, SHIM_DIR, SHIM_FILE, HOSTS_DIR, WATCH_LOG_FILE, CAPTURE_INTERVAL_MS = 15000, MAX_CHATS_PER_TICK = 10, ABANDONED_TURN_AGE_MS, CHAT_ROOTS_FILE, WATCHER_PID_FILE, WATCHER_STALE_MS, PLATFORM = "terminal", SOURCE = "freebuff", CLIENT_ID = "freebuff", ZEST_SESSION_NAMESPACE = "5b0f6c2e-8a41-4d7e-9c3b-2f6e1a9d4c87", MIN_MESSAGES_PER_SESSION = 1, POSTHOG_API_KEY = "phc_cSYAEzsJX9gr0sgCp4tfnr7QJ71PwGD04eUQSglw4iQ";
var init_constants = __esm(() => {
  init_plugin_runtime();
  init_plugin_runtime();
  AGENTS_DIR = process.env.ZEST_FREEBUFF_AGENTS_DIR || join8(homedir(), ".agents");
  AGENT_LOADER_FILE = join8(AGENTS_DIR, "zest-freebuff.js");
  FREEBUFF_ZEST_DIR = process.env.ZEST_FREEBUFF_STATE_DIR || join8(homedir(), ".freebuff-zest");
  ({
    queueDir: QUEUE_DIR,
    stateDir: STATE_DIR,
    logsDir: LOGS_DIR,
    settingsFile: SETTINGS_FILE,
    messagesQueueFile: MESSAGES_QUEUE_FILE
  } = pluginStatePaths(FREEBUFF_ZEST_DIR));
  SYNC_LOCK_FILE = join8(QUEUE_DIR, "sync");
  INSTALLED_CLI_FILE = join8(FREEBUFF_ZEST_DIR, "lib", "cli.mjs");
  SHIM_DIR = join8(FREEBUFF_ZEST_DIR, "bin");
  SHIM_FILE = join8(SHIM_DIR, "freebuff");
  HOSTS_DIR = join8(FREEBUFF_ZEST_DIR, "hosts");
  WATCH_LOG_FILE = join8(LOGS_DIR, "watch.log");
  ABANDONED_TURN_AGE_MS = 30 * 60 * 1000;
  CHAT_ROOTS_FILE = join8(FREEBUFF_ZEST_DIR, "chat-roots.json");
  WATCHER_PID_FILE = join8(FREEBUFF_ZEST_DIR, "watcher.pid");
  WATCHER_STALE_MS = 4 * CAPTURE_INTERVAL_MS;
});

// ../../packages/privacy-redaction/src/config/defaults.ts
function createPrivacyConfig(partial) {
  if (!partial) {
    return { ...DEFAULT_PRIVACY_CONFIG };
  }
  return {
    ...DEFAULT_PRIVACY_CONFIG,
    ...partial,
    enabledPatterns: partial.enabledPatterns ?? DEFAULT_PRIVACY_CONFIG.enabledPatterns,
    customExclusionPatterns: partial.customExclusionPatterns ?? DEFAULT_PRIVACY_CONFIG.customExclusionPatterns
  };
}
var DEFAULT_MAX_FILE_SIZE_BYTES, DEFAULT_PRIVACY_CONFIG;
var init_defaults = __esm(() => {
  DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  DEFAULT_PRIVACY_CONFIG = {
    approach: "detection",
    aggressiveMode: false,
    enabledPatterns: [],
    enableGitignore: true,
    enableZestRules: true,
    customExclusionPatterns: [],
    maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES
  };
});

// ../../packages/privacy-redaction/src/patterns/sensitive-patterns.ts
function createPattern(name, description, regex, category, options = {}) {
  return {
    name,
    description,
    regex,
    category,
    redactionStrategy: "full",
    aggressiveOnly: options.aggressiveOnly ?? false,
    highlySensitive: options.highlySensitive ?? false,
    priority: options.priority ?? 50
  };
}
var SECRET_WORD, KEY_SUFFIX, UNQUOTED_VALUE, SENSITIVE_DATA_PATTERNS;
var init_sensitive_patterns = __esm(() => {
  SECRET_WORD = String.raw`(?:password|passwd|passphrase|pass|pwd|secret|token|api[_-]?key|apikey|(?:access|private|auth|signing|encryption|master|session)[_-]?key|credentials?|salt)`;
  KEY_SUFFIX = String.raw`(?:[_.-][A-Za-z0-9_.-]*)?`;
  UNQUOTED_VALUE = String.raw`[^\s"'\x60$<{(\[,;=\\][^\s"'\x60,;\\]{5,}`;
  SENSITIVE_DATA_PATTERNS = [
    createPattern("api_key_unquoted", "API keys and access keys (unquoted)", /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key)["\s]*(?:[:=]|is)["\s]*([a-zA-Z0-9_\-=+/]{16,})(?=\s|$|[^\w\-=+/])/gi, "api_keys", { priority: 55 }),
    createPattern("jwt_token", "JWT tokens", /eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*/g, "api_keys", { priority: 70 }),
    createPattern("generic_secret", "Generic secrets and passwords (quoted)", new RegExp(String.raw`${SECRET_WORD}${KEY_SUFFIX}\\?["']?[ \t]*[:=][ \t]*\\?["']([^"'\n]{6,}?)(?=\\?["'])`, "gi"), "generic", { highlySensitive: true, priority: 40 }),
    createPattern("generic_secret_unquoted", "Generic secrets and passwords (unquoted)", /(?:password|passwd|pwd)["\s]*[:=]["\s]*([^\s"']{6,})/gi, "generic", { highlySensitive: true, priority: 45 }),
    createPattern("env_secret_assignment", "Unquoted env-style secret assignments (CLOUDFLARE_API_TOKEN=..., SECRET_KEY_BASE=..., SMTP_PASS=...)", new RegExp(String.raw`(?:(?:SECRET|TOKEN|PASSWORD|PASSWD|PASSPHRASE|PASS|PWD)(?:_[A-Z0-9_]+)?|KEY|CREDENTIALS)[ \t]*[:=][ \t]*(${UNQUOTED_VALUE})`, "g"), "generic", { highlySensitive: true, priority: 50 }),
    createPattern("secret_assignment", "Secret key/value pairs in config lines, CLI flags and query strings", new RegExp(String.raw`(?:(?:^|[\r\n"])[ \t]*(?:-[ \t]+|export[ \t]+)?[A-Za-z0-9_.-]*?${SECRET_WORD}${KEY_SUFFIX}["']?[ \t]*[:=][ \t]*|(?:^|[ \t])--[A-Za-z0-9_.-]*?${SECRET_WORD}${KEY_SUFFIX}(?:=|[ \t]+)|[?&][A-Za-z0-9_.-]*?${SECRET_WORD}${KEY_SUFFIX}=)` + String.raw`(?=[^\s"'\x60,;\\&]*[0-9+/=_.@!#%^&*~-]|[A-Za-z]{16})([^\s"'\x60$<{(\[,;=\\&][^\s"'\x60,;\\&]{5,})`, "gi"), "generic", { highlySensitive: true, priority: 50 }),
    createPattern("bearer_token", "Authorization Bearer tokens (any case)", /\bbearer\s+([A-Za-z0-9._~+/=-]{16,})/gi, "generic", { highlySensitive: true, priority: 80 }),
    createPattern("auth_header", "Authorization and API-key header values", new RegExp(String.raw`\b(?:(?:proxy-)?authorization\\?["']?[ \t]*[:=][ \t]*\\?["']?(?:(?:bearer|basic|token|bot|digest)[ \t]+)?|(?:x-auth-key|x-api-key|api-key|x-auth-token|x-access-token|private-token|x-goog-api-key|x-figma-token)\\?["']?[ \t]*[:=][ \t]*\\?["']?)([A-Za-z0-9._~+/=-]{8,})`, "gi"), "generic", { highlySensitive: true, priority: 80 }),
    createPattern("session_cookie", "Session and token cookies and parameters (zest.session_token=..., app_session=...)", /(?:session|token)[A-Za-z0-9_.-]*=([^\s;"',&\\]{8,})/gi, "generic", { highlySensitive: true, priority: 75 }),
    createPattern("url_credentials", "Credentials embedded in URLs (scheme://user:pass@host)", /:\/\/([^\s/:@]*:[^\s/@]+)(?=@)/g, "generic", { highlySensitive: true, priority: 85 }),
    createPattern("cli_password", "Passwords on command lines (sshpass -p, mysql -p, --password)", /(?:\bsshpass[ \t]+-p[ \t]*|\b(?:mysql|mysqldump|mysqladmin|mariadb)\b[^\n|;&]*?[ \t]-p|[ \t]--password(?:=|[ \t]+))(\\?'[^'\n]+'|\\?"[^"\n]+?\\?"|[^\s'"\\;|&]+)/g, "generic", { highlySensitive: true, priority: 85 }),
    createPattern("zest_api_key", "Zest API keys", /\bzest_(?:mcp_)?[A-Za-z0-9]{24,}/g, "api_keys", {
      highlySensitive: true,
      priority: 95
    }),
    createPattern("aws_access_key", "AWS access key ids (long-term AKIA and temporary STS ASIA)", /(?:AKIA|ASIA)[0-9A-Z]{16}/g, "cloud_services", { highlySensitive: true, priority: 90 }),
    createPattern("aws_secret_key", "AWS secret access keys", /(?:aws[_-]?secret[_-]?access[_-]?key)["\s]*[:=]["\s]*([a-zA-Z0-9/+=]{40})/gi, "cloud_services", { highlySensitive: true, priority: 90 }),
    createPattern("github_token", "GitHub personal access tokens", /gh[pousr]_[A-Za-z0-9_]{36,255}/g, "api_keys", { highlySensitive: true, priority: 85 }),
    createPattern("github_app_token", "GitHub App installation access tokens", /ghs_[A-Za-z0-9_]{36}/g, "api_keys", { highlySensitive: true, priority: 85 }),
    createPattern("github_oauth_token", "GitHub OAuth access tokens", /gho_[A-Za-z0-9_]{36}/g, "api_keys", { highlySensitive: true, priority: 85 }),
    createPattern("github_fine_grained_pat", "GitHub fine-grained personal access tokens", /\bgithub_pat_[A-Za-z0-9_]{22,}/g, "api_keys", { highlySensitive: true, priority: 85 }),
    createPattern("gitlab_token", "GitLab personal access tokens", /glpat-[A-Za-z0-9_\-]{20,}/g, "api_keys", { highlySensitive: true, priority: 85 }),
    createPattern("bitbucket_token", "Bitbucket app passwords", /ATB[A-Za-z0-9]{95}/g, "api_keys", {
      highlySensitive: true,
      priority: 85
    }),
    createPattern("atlassian_token", "Atlassian API tokens", /ATATT[A-Za-z0-9\-_]{60}/g, "api_keys", {
      priority: 80
    }),
    createPattern("slack_token", "Slack API tokens", /xox[baprs]-[A-Za-z0-9\-]+/g, "communication", {
      highlySensitive: true,
      priority: 80
    }),
    createPattern("slack_webhook", "Slack incoming-webhook URLs", /https?:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9_/-]+/g, "communication", { highlySensitive: true, priority: 90 }),
    createPattern("discord_token", "Discord bot tokens", /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g, "communication", { highlySensitive: true, priority: 80 }),
    createPattern("discord_webhook", "Discord webhook URLs", /https?:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, "communication", { highlySensitive: true, priority: 90 }),
    createPattern("telegram_bot_token", "Telegram bot tokens", /(?:\/bot|\b)(\d{8,10}:[A-Za-z0-9_-]{35})(?![A-Za-z0-9_-])/g, "communication", { highlySensitive: true, priority: 80 }),
    createPattern("stripe_key", "Stripe secret keys (live and test)", /\bsk_(?:live|test)_[A-Za-z0-9]{24,}/g, "payment", { highlySensitive: true, priority: 95 }),
    createPattern("stripe_publishable_key", "Stripe live publishable keys", /pk_live_[A-Za-z0-9]{24}/g, "payment", { priority: 70 }),
    createPattern("stripe_restricted_key", "Stripe restricted keys (live and test)", /\brk_(?:live|test)_[A-Za-z0-9]{24,}/g, "payment", { highlySensitive: true, priority: 95 }),
    createPattern("stripe_webhook_secret", "Stripe webhook signing secrets", /\bwhsec_[A-Za-z0-9+/=]{24,}/g, "payment", { highlySensitive: true, priority: 95 }),
    createPattern("paypal_client_id", "PayPal client IDs", /A[A-Za-z0-9\-_]{79}/g, "payment", {
      highlySensitive: true,
      priority: 75,
      aggressiveOnly: true
    }),
    createPattern("square_token", "Square access tokens", /sq0atp-[A-Za-z0-9\-_]{22}/g, "payment", {
      highlySensitive: true,
      priority: 85
    }),
    createPattern("shopify_token", "Shopify access tokens", /shpat_[a-fA-F0-9]{32}/g, "payment", {
      highlySensitive: true,
      priority: 85
    }),
    createPattern("shopify_secret", "Shopify shared secrets", /shpss_[a-fA-F0-9]{32}/g, "payment", {
      highlySensitive: true,
      priority: 85
    }),
    createPattern("twilio_token", "Twilio account and API key SIDs", /\b(?:AC|SK)[0-9a-f]{32}\b/g, "communication", { highlySensitive: true, priority: 75 }),
    createPattern("sendgrid_key", "SendGrid API keys", /SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}/g, "communication", { highlySensitive: true, priority: 85 }),
    createPattern("mailgun_key", "Mailgun API keys", /key-[a-f0-9]{32}/g, "communication", {
      highlySensitive: true,
      priority: 80
    }),
    createPattern("resend_key", "Resend API keys", /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}/g, "communication", { highlySensitive: true, priority: 85 }),
    createPattern("firebase_key", "Firebase API keys", /AIza[A-Za-z0-9\-_]{35}/g, "cloud_services", {
      priority: 75
    }),
    createPattern("google_api_key", "Google Cloud API keys", /AIza[A-Za-z0-9\-_]{35}/g, "cloud_services", { highlySensitive: true, priority: 80 }),
    createPattern("google_oauth_secret", "Google OAuth client secrets", /GOCSPX-[A-Za-z0-9_-]{24,}/g, "cloud_services", { highlySensitive: true, priority: 90 }),
    createPattern("azure_storage_key", "Azure Storage account keys", /[A-Za-z0-9+/]{88}==/g, "cloud_services", { highlySensitive: true, priority: 70, aggressiveOnly: true }),
    createPattern("azure_connection_key", "Azure connection-string keys (AccountKey=..., SharedAccessKey=...)", /(?:AccountKey|SharedAccessKey)=([A-Za-z0-9+/]{20,}={0,2})/gi, "cloud_services", { highlySensitive: true, priority: 90 }),
    createPattern("heroku_key", "Heroku API keys", /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, "cloud_services", { highlySensitive: true, priority: 50, aggressiveOnly: true }),
    createPattern("digitalocean_token", "DigitalOcean personal access tokens", /dop_v1_[a-f0-9]{64}/g, "cloud_services", { highlySensitive: true, priority: 85 }),
    createPattern("cloudflare_token", "Cloudflare API tokens (generic pattern)", /[A-Za-z0-9\-_]{40}/g, "cloud_services", { highlySensitive: true, priority: 30, aggressiveOnly: true }),
    createPattern("doppler_token", "Doppler tokens (dp.st., dp.pt., dp.ct., dp.sa.)", /\bdp\.(?:pt|st|ct|sa|scim|audit)\.[A-Za-z0-9._-]{20,}/g, "cloud_services", { highlySensitive: true, priority: 90 }),
    createPattern("sentry_dsn", "Sentry DSN keys", /:\/\/([0-9a-f]{32}(?::[0-9a-f]{32})?)(?=@[A-Za-z0-9.-]*sentry[A-Za-z0-9.-]*\/\d+)/g, "cloud_services", { highlySensitive: true, priority: 90 }),
    createPattern("npm_token", "npm authentication tokens", /npm_[A-Za-z0-9]{36}/g, "api_keys", {
      priority: 80
    }),
    createPattern("docker_token", "Docker Hub personal access tokens", /dckr_pat_[A-Za-z0-9\-_]{36}/g, "api_keys", { priority: 80 }),
    createPattern("vercel_token", "Vercel access tokens", /vercel_[A-Za-z0-9]{24}/g, "cloud_services", { highlySensitive: true, priority: 80 }),
    createPattern("netlify_token", "Netlify access tokens", /netlify_[A-Za-z0-9\-_]{64}/g, "cloud_services", { highlySensitive: true, priority: 80 }),
    createPattern("railway_token", "Railway API tokens", /railway_[A-Za-z0-9]{40}/g, "cloud_services", { highlySensitive: true, priority: 80 }),
    createPattern("pypi_token", "PyPI API tokens", /\bpypi-[A-Za-z0-9_-]{50,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("linear_key", "Linear API keys", /\blin_(?:api|oauth)_[A-Za-z0-9]{20,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("notion_token", "Notion integration tokens (secret_..., ntn_...)", /\b(?:secret|ntn)_[A-Za-z0-9]{40,}/g, "api_keys", { highlySensitive: true, priority: 85 }),
    createPattern("figma_token", "Figma personal access tokens", /\bfigd_[A-Za-z0-9_-]{20,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("posthog_personal_key", "PostHog personal API keys", /\bphx_[A-Za-z0-9]{30,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("openai_key", "OpenAI API keys", /\bsk-[A-Za-z0-9]{48}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("openai_project_key", "OpenAI project, service-account and admin API keys", /\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]*T3BlbkFJ[A-Za-z0-9_-]+)/g, "api_keys", { highlySensitive: true, priority: 90 }),
    createPattern("openrouter_key", "OpenRouter API keys", /\bsk-or-v1-[A-Za-z0-9]{32,}/g, "api_keys", { highlySensitive: true, priority: 90 }),
    createPattern("anthropic_key", "Anthropic API keys", /sk-ant-[A-Za-z0-9\-_]{80,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("anthropic_key_truncated", "Truncated Anthropic API keys", /sk-ant-[A-Za-z0-9\-_]{20,79}/g, "api_keys", { highlySensitive: true, priority: 80 }),
    createPattern("groq_key", "Groq API keys", /\bgsk_[A-Za-z0-9]{20,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("xai_key", "xAI API keys", /\bxai-[A-Za-z0-9]{20,}/g, "api_keys", {
      highlySensitive: true,
      priority: 90
    }),
    createPattern("huggingface_token", "Hugging Face tokens", /\bhf_[A-Za-z0-9]{30,}/g, "api_keys", {
      highlySensitive: true,
      priority: 85
    }),
    createPattern("auth0_secret", "Auth0 client secrets (generic pattern)", /[A-Za-z0-9\-_]{64}/g, "api_keys", { highlySensitive: true, priority: 25, aggressiveOnly: true }),
    createPattern("okta_token", "Okta API tokens", /00[A-Za-z0-9]{38}/g, "api_keys", {
      highlySensitive: true,
      priority: 70,
      aggressiveOnly: true
    }),
    createPattern("planetscale_password", "PlanetScale database passwords", /pscale_pw_[A-Za-z0-9\-_]{32}/g, "database", { highlySensitive: true, priority: 85 }),
    createPattern("mongodb_atlas", "MongoDB Atlas connection strings", /mongodb\+srv:\/\/[^:\s]+:[^@\s]+@[^\/\s]+\.mongodb\.net\/[^\s]*/gi, "database", { highlySensitive: true, priority: 90 }),
    createPattern("mongodb_connection", "MongoDB connection strings with credentials", /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s"']+/gi, "database", { highlySensitive: true, priority: 85 }),
    createPattern("supabase_key", "Supabase service role keys (JWT format)", /eyJ[A-Za-z0-9\-_]*\.eyJ[A-Za-z0-9\-_]*\.[A-Za-z0-9\-_]*/g, "database", { highlySensitive: true, priority: 65 }),
    createPattern("supabase_secret_key", "Supabase secret API keys", /\bsb_secret_[A-Za-z0-9_-]{20,}/g, "database", { highlySensitive: true, priority: 90 }),
    createPattern("db_connection", "Database connection strings with credentials", /(?:mongodb|mysql|postgresql|postgres|rediss?|amqps?):\/\/[^\s"'/@]*@[^\s"']+/gi, "database", { highlySensitive: true, priority: 80 }),
    createPattern("private_key", "Private keys in PEM format (with or without the END line)", /-----BEGIN[A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----(?:[\s\S]*?-----END[A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|[A-Za-z0-9+/=\s:,\\-]*)/g, "cryptographic", { highlySensitive: true, priority: 100 }),
    createPattern("email", "Email addresses", /\b(?!git@)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "pii", { priority: 60 }),
    createPattern("email_in_config", "Email addresses in configuration", /(?:email|user|username|admin)["\s]*[:=]["\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, "pii", { priority: 60, aggressiveOnly: true }),
    createPattern("credit_card", "Credit card numbers (continuous digits)", /(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})/g, "pii", { highlySensitive: true, priority: 95 }),
    createPattern("credit_card_formatted", "Credit card numbers (with dashes or spaces)", /(?:4[0-9]{3}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}|5[1-5][0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}|3[47][0-9]{2}[-\s]?[0-9]{6}[-\s]?[0-9]{5})/g, "pii", { highlySensitive: true, priority: 95 }),
    createPattern("ssn", "Social Security Numbers", /\b\d{3}-\d{2}-\d{4}\b/g, "pii", {
      highlySensitive: true,
      priority: 95
    }),
    createPattern("private_ip", "Private IP addresses", /\b(?:10\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|172\.(?:1[6-9]|2[0-9]|3[01])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|192\.168\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))\b/g, "network", { priority: 50, aggressiveOnly: true }),
    createPattern("session_pem_private_key", "Session analysis: PEM private key blocks", /-----BEGIN[A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z0-9 ]*PRIVATE KEY-----/g, "cryptographic", { highlySensitive: true, priority: 100, aggressiveOnly: true }),
    createPattern("session_url_credentials", "Session analysis: credential-bearing URLs (scheme://user:pass@host)", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi, "generic", { highlySensitive: true, priority: 85, aggressiveOnly: true }),
    createPattern("session_jwt", "Session analysis: JSON Web Tokens", /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "api_keys", { highlySensitive: true, priority: 70, aggressiveOnly: true }),
    createPattern("session_github_token", "Session analysis: GitHub tokens (personal, OAuth, app, refresh, server)", /\bgh[pousr]_[A-Za-z0-9_]{20,255}\b/g, "api_keys", { highlySensitive: true, priority: 85, aggressiveOnly: true }),
    createPattern("session_slack_token", "Session analysis: Slack API tokens", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, "communication", { highlySensitive: true, priority: 80, aggressiveOnly: true }),
    createPattern("session_google_api_key", "Session analysis: Google API keys", /\bAIza[0-9A-Za-z_-]{35}\b/g, "cloud_services", { highlySensitive: true, priority: 80, aggressiveOnly: true }),
    createPattern("session_sk_key", "Session analysis: OpenAI/Anthropic-style sk- secret keys", /\bsk-[A-Za-z0-9_-]{20,}\b/g, "api_keys", { highlySensitive: true, priority: 90, aggressiveOnly: true }),
    createPattern("session_github_pat", "Session analysis: GitHub fine-grained personal access tokens", /\bgithub_pat_[A-Za-z0-9_]+\b/g, "api_keys", { highlySensitive: true, priority: 85, aggressiveOnly: true }),
    createPattern("session_gitlab_token", "Session analysis: GitLab personal/project access tokens", /\bglpat-[A-Za-z0-9_-]+/g, "api_keys", { highlySensitive: true, priority: 85, aggressiveOnly: true }),
    createPattern("session_npm_token", "Session analysis: npm automation/access tokens", /\bnpm_[A-Za-z0-9]+\b/g, "api_keys", { priority: 80, aggressiveOnly: true }),
    createPattern("session_stripe_key", "Session analysis: Stripe secret/restricted keys (live and test)", /\b[sr]k_(?:live|test)_[A-Za-z0-9]+\b/g, "payment", { highlySensitive: true, priority: 95, aggressiveOnly: true }),
    createPattern("session_aws_access_key", "Session analysis: AWS access key IDs", /\bAKIA[0-9A-Z]{16}\b/g, "cloud_services", { highlySensitive: true, priority: 90, aggressiveOnly: true }),
    createPattern("session_aws_temp_key", "Session analysis: AWS temporary (STS) access key IDs", /\bASIA[A-Z0-9]{12,}\b/g, "cloud_services", { highlySensitive: true, priority: 90, aggressiveOnly: true }),
    createPattern("session_bearer_token", "Session analysis: Authorization Bearer headers", /\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/gi, "api_keys", { highlySensitive: true, priority: 80, aggressiveOnly: true }),
    createPattern("session_secret_assignment", "Session analysis: explicit secret assignments (api_key=..., password: ...)", /\b(?:api[_-]?key|secret[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key|secret|password|passwd|pwd|token)\b\s*[:=]\s*["']?[^\s"']{6,}["']?/gi, "generic", { highlySensitive: true, priority: 45, aggressiveOnly: true }),
    createPattern("session_ipv4", "Session analysis: IPv4 addresses (all four-octet addresses)", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "network", { priority: 50, aggressiveOnly: true })
  ];
});

// ../../packages/privacy-redaction/src/patterns/categories.ts
function isHighlySensitivePattern(patternName) {
  return HIGHLY_SENSITIVE.has(patternName);
}
function selectPatterns(aggressiveMode, enabledPatterns) {
  const extra = new Set(enabledPatterns);
  return SENSITIVE_DATA_PATTERNS.filter((pattern) => !pattern.aggressiveOnly || aggressiveMode || extra.has(pattern.name));
}
var HIGHLY_SENSITIVE;
var init_categories = __esm(() => {
  init_sensitive_patterns();
  HIGHLY_SENSITIVE = new Set(SENSITIVE_DATA_PATTERNS.filter((p) => p.highlySensitive).map((p) => p.name));
});

// ../../packages/privacy-redaction/src/patterns/index.ts
var init_patterns = __esm(() => {
  init_categories();
  init_sensitive_patterns();
});

// ../../packages/privacy-redaction/src/detection/cache.ts
class DetectionCache {
  cache = new Map;
  maxEntries;
  ttlMs;
  constructor(options = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return;
    }
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }
  set(key, value) {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  has(key) {
    return this.get(key) !== undefined;
  }
  delete(key) {
    return this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
  prune() {
    const now = Date.now();
    let pruned = 0;
    const keysToDelete = [];
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.ttlMs) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.cache.delete(key);
      pruned++;
    }
    return pruned;
  }
}
function computeContentHash(content) {
  let hash = 0;
  for (let i = 0;i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
function generateCacheKey(content, context) {
  const contentHash = computeContentHash(content);
  if (context) {
    const contextHash = computeContentHash(context);
    return `${contentHash}:${contextHash}`;
  }
  return contentHash;
}

// ../../packages/privacy-redaction/src/detection/detector.ts
class SensitiveDataDetector {
  patterns;
  config;
  cache;
  stats;
  constructor(options) {
    this.config = options.config;
    this.patterns = selectPatterns(options.config.aggressiveMode, options.config.enabledPatterns);
    if (options.enableCache !== false) {
      this.cache = new DetectionCache({
        maxEntries: options.maxCacheEntries ?? 1000,
        ttlMs: options.cacheTtlMs ?? 5 * 60 * 1000
      });
    } else {
      this.cache = null;
    }
    this.stats = this.createEmptyStats();
  }
  createEmptyStats() {
    return {
      totalDetections: 0,
      byPattern: {},
      byCategory: {},
      contentScanned: 0,
      cacheHits: 0
    };
  }
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.patterns = selectPatterns(this.config.aggressiveMode, this.config.enabledPatterns);
    this.cache?.clear();
  }
  getConfig() {
    return { ...this.config };
  }
  scanContent(content, context) {
    if (this.cache) {
      const cacheKey = generateCacheKey(content, context);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, fromCache: true };
      }
    }
    const detections = this.performScan(content);
    const deduplicatedDetections = this.mergeOverlappingDetections(detections, content);
    this.stats.contentScanned++;
    this.stats.totalDetections += deduplicatedDetections.length;
    for (const detection of deduplicatedDetections) {
      this.stats.byPattern[detection.pattern] = (this.stats.byPattern[detection.pattern] || 0) + 1;
      this.stats.byCategory[detection.category] = (this.stats.byCategory[detection.category] || 0) + 1;
    }
    const result = {
      hasSensitiveData: deduplicatedDetections.length > 0,
      detections: deduplicatedDetections,
      fromCache: false
    };
    if (this.cache) {
      const cacheKey = generateCacheKey(content, context);
      this.cache.set(cacheKey, result);
    }
    return result;
  }
  performScan(content) {
    const detections = [];
    const text = content.replace(/\\([nrt])/g, (_escape, c) => ` ${UNESCAPED[c]}`);
    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      const matches = Array.from(text.matchAll(pattern.regex));
      for (const match of matches) {
        if (match.index === undefined)
          continue;
        let start = match.index;
        let end = match.index + match[0].length;
        if (match[1] !== undefined) {
          const sensitiveValue = match[1];
          const sensitiveStartInMatch = match[0].endsWith(sensitiveValue) ? match[0].length - sensitiveValue.length : match[0].indexOf(sensitiveValue);
          if (sensitiveStartInMatch !== -1) {
            start = match.index + sensitiveStartInMatch;
            end = start + sensitiveValue.length;
          }
        }
        detections.push({
          pattern: pattern.name,
          description: pattern.description,
          position: { start, end },
          matchedText: content.slice(start, end),
          redactionStrategy: pattern.redactionStrategy,
          category: pattern.category,
          highlySensitive: pattern.highlySensitive
        });
      }
    }
    return detections;
  }
  mergeOverlappingDetections(detections, content) {
    if (detections.length <= 1) {
      return detections;
    }
    const sorted = [...detections].sort((a, b) => {
      if (a.position.start !== b.position.start) {
        return a.position.start - b.position.start;
      }
      return this.getPatternPriority(b.pattern) - this.getPatternPriority(a.pattern);
    });
    const merged = [];
    for (const detection of sorted) {
      const last = merged[merged.length - 1];
      if (!last || detection.position.start >= last.position.end) {
        merged.push(detection);
        continue;
      }
      const label = this.getPatternPriority(detection.pattern) > this.getPatternPriority(last.pattern) ? detection : last;
      const start = last.position.start;
      const end = Math.max(last.position.end, detection.position.end);
      merged[merged.length - 1] = {
        ...label,
        position: { start, end },
        matchedText: content.slice(start, end)
      };
    }
    return merged;
  }
  getPatternPriority(patternName) {
    const pattern = this.patterns.find((p) => p.name === patternName);
    return pattern?.priority ?? 50;
  }
  hasHighlySensitiveData(detections) {
    return detections.some((d) => d.highlySensitive || isHighlySensitivePattern(d.pattern));
  }
  getStats() {
    return { ...this.stats };
  }
  clearStats() {
    this.stats = this.createEmptyStats();
  }
  clearCache() {
    this.cache?.clear();
  }
  clearAll() {
    this.clearStats();
    this.clearCache();
  }
  getCacheSize() {
    return this.cache?.size ?? 0;
  }
  getActivePatterns() {
    return [...this.patterns];
  }
  getActivePatternCount() {
    return this.patterns.length;
  }
}
var UNESCAPED;
var init_detector = __esm(() => {
  init_patterns();
  UNESCAPED = { n: `
`, r: "\r", t: "\t" };
});

// ../../packages/privacy-redaction/src/detection/index.ts
var init_detection = __esm(() => {
  init_detector();
});

// ../../packages/privacy-redaction/src/exclusion/built-in-rules.ts
function getBuiltInPatterns() {
  return new Set(ALL_BUILT_IN_RULES.map((rule) => rule.pattern));
}
var SENSITIVE_FILE_RULES, SENSITIVE_DIRECTORY_RULES, BUILD_ARTIFACT_RULES, LOCK_FILE_RULES, BINARY_MEDIA_RULES, ALL_BUILT_IN_RULES;
var init_built_in_rules = __esm(() => {
  SENSITIVE_FILE_RULES = [
    { pattern: "*.env*", category: "sensitive_files", description: "Environment files" },
    { pattern: "*.key", category: "sensitive_files", description: "Key files" },
    { pattern: "*.pem", category: "sensitive_files", description: "PEM certificate files" },
    { pattern: "*.p12", category: "sensitive_files", description: "PKCS#12 files" },
    { pattern: "*.pfx", category: "sensitive_files", description: "PFX certificate files" },
    { pattern: "*.jks", category: "sensitive_files", description: "Java keystore files" },
    { pattern: "*.keystore", category: "sensitive_files", description: "Keystore files" }
  ];
  SENSITIVE_DIRECTORY_RULES = [
    { pattern: "**/secrets/**", category: "sensitive_directories", description: "Secrets directory" },
    {
      pattern: "**/credentials/**",
      category: "sensitive_directories",
      description: "Credentials directory"
    },
    { pattern: "**/private/**", category: "sensitive_directories", description: "Private directory" },
    { pattern: "**/.ssh/**", category: "sensitive_directories", description: "SSH directory" },
    { pattern: "**/.aws/**", category: "sensitive_directories", description: "AWS credentials" },
    { pattern: "**/.gcp/**", category: "sensitive_directories", description: "GCP credentials" }
  ];
  BUILD_ARTIFACT_RULES = [
    { pattern: "**/node_modules/**", category: "build_artifacts", description: "Node.js modules" },
    { pattern: "**/.git/**", category: "build_artifacts", description: "Git directory" },
    { pattern: "**/dist/**", category: "build_artifacts", description: "Distribution folder" },
    { pattern: "**/build/**", category: "build_artifacts", description: "Build folder" },
    { pattern: "**/out/**", category: "build_artifacts", description: "Output folder" },
    { pattern: "**/*.min.js", category: "build_artifacts", description: "Minified JavaScript" },
    { pattern: "**/*.min.css", category: "build_artifacts", description: "Minified CSS" },
    { pattern: "**/coverage/**", category: "build_artifacts", description: "Coverage reports" },
    { pattern: "**/.nyc_output/**", category: "build_artifacts", description: "NYC coverage output" },
    { pattern: "**/logs/**", category: "build_artifacts", description: "Log directory" },
    { pattern: "**/*.log", category: "build_artifacts", description: "Log files" },
    { pattern: "**/tmp/**", category: "build_artifacts", description: "Temp directory" },
    { pattern: "**/temp/**", category: "build_artifacts", description: "Temp directory" },
    { pattern: "**/.cache/**", category: "build_artifacts", description: "Cache directory" },
    { pattern: "**/.DS_Store", category: "build_artifacts", description: "macOS metadata" },
    { pattern: "**/Thumbs.db", category: "build_artifacts", description: "Windows thumbnails" }
  ];
  LOCK_FILE_RULES = [
    { pattern: "**/package-lock.json", category: "lock_files", description: "npm lock file" },
    { pattern: "**/yarn.lock", category: "lock_files", description: "Yarn lock file" },
    { pattern: "**/pnpm-lock.yaml", category: "lock_files", description: "pnpm lock file" },
    { pattern: "**/bun.lockb", category: "lock_files", description: "Bun lock file (binary)" },
    { pattern: "**/bun.lock", category: "lock_files", description: "Bun lock file" },
    { pattern: "**/poetry.lock", category: "lock_files", description: "Poetry lock file" },
    { pattern: "**/Pipfile.lock", category: "lock_files", description: "Pipenv lock file" },
    { pattern: "**/requirements.lock", category: "lock_files", description: "Requirements lock" },
    { pattern: "**/Gemfile.lock", category: "lock_files", description: "Bundler lock file" },
    { pattern: "**/composer.lock", category: "lock_files", description: "Composer lock file" },
    { pattern: "**/Cargo.lock", category: "lock_files", description: "Cargo lock file" },
    { pattern: "**/go.sum", category: "lock_files", description: "Go checksum file" },
    { pattern: "**/packages.lock.json", category: "lock_files", description: ".NET lock file" },
    { pattern: "**/project.assets.json", category: "lock_files", description: ".NET assets" },
    { pattern: "**/pubspec.lock", category: "lock_files", description: "Pub lock file" },
    { pattern: "**/mix.lock", category: "lock_files", description: "Mix lock file" },
    { pattern: "**/Package.resolved", category: "lock_files", description: "Swift PM lock" },
    { pattern: "**/gradle.lockfile", category: "lock_files", description: "Gradle lock file" },
    { pattern: "**/gradle/dependencies.lock", category: "lock_files", description: "Gradle deps" },
    { pattern: "**/renv.lock", category: "lock_files", description: "renv lock file" },
    { pattern: "**/packrat/packrat.lock", category: "lock_files", description: "Packrat lock" },
    { pattern: "**/cabal.project.freeze", category: "lock_files", description: "Cabal freeze" },
    { pattern: "**/stack.yaml.lock", category: "lock_files", description: "Stack lock file" },
    { pattern: "**/Manifest.toml", category: "lock_files", description: "Julia manifest" },
    { pattern: "**/.terraform.lock.hcl", category: "lock_files", description: "Terraform lock" },
    { pattern: "**/flake.lock", category: "lock_files", description: "Nix flake lock" },
    { pattern: "**/npm-shrinkwrap.json", category: "lock_files", description: "npm shrinkwrap" }
  ];
  BINARY_MEDIA_RULES = [
    { pattern: "**/*.exe", category: "binary_media", description: "Windows executable" },
    { pattern: "**/*.dll", category: "binary_media", description: "Windows library" },
    { pattern: "**/*.so", category: "binary_media", description: "Shared object" },
    { pattern: "**/*.dylib", category: "binary_media", description: "macOS library" },
    { pattern: "**/*.bin", category: "binary_media", description: "Binary file" },
    { pattern: "**/*.obj", category: "binary_media", description: "Object file" },
    { pattern: "**/*.o", category: "binary_media", description: "Object file" },
    { pattern: "**/*.a", category: "binary_media", description: "Static library" },
    { pattern: "**/*.lib", category: "binary_media", description: "Library file" },
    { pattern: "**/*.jar", category: "binary_media", description: "Java archive" },
    { pattern: "**/*.war", category: "binary_media", description: "Web archive" },
    { pattern: "**/*.ear", category: "binary_media", description: "Enterprise archive" },
    { pattern: "**/*.class", category: "binary_media", description: "Java class" },
    { pattern: "**/*.pyc", category: "binary_media", description: "Python bytecode" },
    { pattern: "**/*.pyo", category: "binary_media", description: "Python optimized" },
    { pattern: "**/*.wasm", category: "binary_media", description: "WebAssembly" },
    { pattern: "**/*.vsix", category: "binary_media", description: "VS Code extension" },
    { pattern: "**/*.jpg", category: "binary_media", description: "JPEG image" },
    { pattern: "**/*.jpeg", category: "binary_media", description: "JPEG image" },
    { pattern: "**/*.png", category: "binary_media", description: "PNG image" },
    { pattern: "**/*.gif", category: "binary_media", description: "GIF image" },
    { pattern: "**/*.bmp", category: "binary_media", description: "Bitmap image" },
    { pattern: "**/*.ico", category: "binary_media", description: "Icon file" },
    { pattern: "**/*.webp", category: "binary_media", description: "WebP image" },
    { pattern: "**/*.tiff", category: "binary_media", description: "TIFF image" },
    { pattern: "**/*.psd", category: "binary_media", description: "Photoshop file" },
    { pattern: "**/*.mp4", category: "binary_media", description: "MP4 video" },
    { pattern: "**/*.avi", category: "binary_media", description: "AVI video" },
    { pattern: "**/*.mov", category: "binary_media", description: "QuickTime video" },
    { pattern: "**/*.wmv", category: "binary_media", description: "WMV video" },
    { pattern: "**/*.flv", category: "binary_media", description: "Flash video" },
    { pattern: "**/*.webm", category: "binary_media", description: "WebM video" },
    { pattern: "**/*.mkv", category: "binary_media", description: "Matroska video" },
    { pattern: "**/*.mp3", category: "binary_media", description: "MP3 audio" },
    { pattern: "**/*.wav", category: "binary_media", description: "WAV audio" },
    { pattern: "**/*.ogg", category: "binary_media", description: "Ogg audio" },
    { pattern: "**/*.flac", category: "binary_media", description: "FLAC audio" },
    { pattern: "**/*.aac", category: "binary_media", description: "AAC audio" },
    { pattern: "**/*.m4a", category: "binary_media", description: "M4A audio" },
    { pattern: "**/*.zip", category: "binary_media", description: "ZIP archive" },
    { pattern: "**/*.tar", category: "binary_media", description: "TAR archive" },
    { pattern: "**/*.gz", category: "binary_media", description: "Gzip archive" },
    { pattern: "**/*.bz2", category: "binary_media", description: "Bzip2 archive" },
    { pattern: "**/*.xz", category: "binary_media", description: "XZ archive" },
    { pattern: "**/*.rar", category: "binary_media", description: "RAR archive" },
    { pattern: "**/*.7z", category: "binary_media", description: "7-Zip archive" },
    { pattern: "**/*.tgz", category: "binary_media", description: "Tarball" },
    { pattern: "**/*.pdf", category: "binary_media", description: "PDF document" },
    { pattern: "**/*.doc", category: "binary_media", description: "Word document" },
    { pattern: "**/*.docx", category: "binary_media", description: "Word document" },
    { pattern: "**/*.xls", category: "binary_media", description: "Excel spreadsheet" },
    { pattern: "**/*.xlsx", category: "binary_media", description: "Excel spreadsheet" },
    { pattern: "**/*.ppt", category: "binary_media", description: "PowerPoint" },
    { pattern: "**/*.pptx", category: "binary_media", description: "PowerPoint" },
    { pattern: "**/*.woff", category: "binary_media", description: "WOFF font" },
    { pattern: "**/*.woff2", category: "binary_media", description: "WOFF2 font" },
    { pattern: "**/*.ttf", category: "binary_media", description: "TrueType font" },
    { pattern: "**/*.otf", category: "binary_media", description: "OpenType font" },
    { pattern: "**/*.eot", category: "binary_media", description: "EOT font" },
    { pattern: "**/*.db", category: "binary_media", description: "Database file" },
    { pattern: "**/*.sqlite", category: "binary_media", description: "SQLite database" },
    { pattern: "**/*.sqlite3", category: "binary_media", description: "SQLite database" }
  ];
  ALL_BUILT_IN_RULES = [
    ...SENSITIVE_FILE_RULES,
    ...SENSITIVE_DIRECTORY_RULES,
    ...BUILD_ARTIFACT_RULES,
    ...LOCK_FILE_RULES,
    ...BINARY_MEDIA_RULES
  ];
});

// ../../packages/privacy-redaction/src/exclusion/gitignore-parser.ts
function parseGitignoreLine(line) {
  let pattern = line.trim();
  if (!pattern || pattern.startsWith("#")) {
    return null;
  }
  pattern = pattern.replace(/\\(\s)$/, "$1");
  const negated = pattern.startsWith("!");
  if (negated) {
    pattern = pattern.substring(1);
  }
  const directoryOnly = pattern.endsWith("/");
  if (directoryOnly) {
    pattern = pattern.slice(0, -1);
  }
  const original = line.trim();
  let glob = pattern;
  if (glob.startsWith("/")) {
    glob = glob.substring(1);
  } else if (!glob.includes("/")) {
    glob = `**/${glob}`;
  }
  if (directoryOnly) {
    glob = `${glob}/**`;
  }
  return {
    original,
    glob,
    negated,
    directoryOnly
  };
}
function parseGitignoreContent(content) {
  const lines = content.split(`
`);
  const patterns = [];
  for (const line of lines) {
    const parsed = parseGitignoreLine(line);
    if (parsed) {
      patterns.push(parsed);
    }
  }
  return patterns;
}
function createGitignoreResult(filePath, content) {
  const directory = filePath.replace(/[/\\][^/\\]*$/, "");
  const patterns = parseGitignoreContent(content);
  const globs = patterns.filter((p) => !p.negated).map((p) => p.glob);
  return {
    filePath,
    directory,
    patterns,
    globs
  };
}
function mergeGitignorePatterns(results) {
  const patternMap = new Map;
  for (const result of results) {
    for (const glob of result.globs) {
      patternMap.set(glob, result.directory);
    }
  }
  return patternMap;
}

// ../../packages/privacy-redaction/src/exclusion/glob-matcher.ts
function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}
function globToRegex(pattern) {
  let normalized = normalizePath(pattern);
  let regexPattern = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "§DOUBLESTAR§").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  regexPattern = regexPattern.replace(/§DOUBLESTAR§\//g, "(?:.*/)?").replace(/\/§DOUBLESTAR§/g, "(?:/.*)?").replace(/§DOUBLESTAR§/g, ".*");
  return new RegExp(`^${regexPattern}$`, "i");
}
function matchesGlob(filePath, pattern, workspaceRoot) {
  const normalizedPath = normalizePath(filePath);
  const regex = globToRegex(pattern);
  if (regex.test(normalizedPath)) {
    return true;
  }
  if (!pattern.includes("/")) {
    const fileName = normalizedPath.split("/").pop() || "";
    if (regex.test(fileName)) {
      return true;
    }
  }
  if (workspaceRoot) {
    const normalizedRoot = normalizePath(workspaceRoot);
    if (normalizedPath.startsWith(normalizedRoot)) {
      let relativePath = normalizedPath.substring(normalizedRoot.length);
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }
      if (regex.test(relativePath)) {
        return true;
      }
    }
  }
  return false;
}
function matchesGlobRelative(filePath, pattern, baseDir) {
  const normalizedPath = normalizePath(filePath);
  const normalizedBase = normalizePath(baseDir);
  if (!normalizedPath.startsWith(normalizedBase)) {
    return false;
  }
  let relativePath = normalizedPath.substring(normalizedBase.length);
  if (relativePath.startsWith("/")) {
    relativePath = relativePath.substring(1);
  }
  return matchesGlob(relativePath, pattern);
}
function findMatchingPattern(filePath, patterns, workspaceRoot) {
  for (const pattern of patterns) {
    if (matchesGlob(filePath, pattern, workspaceRoot)) {
      return pattern;
    }
  }
  return null;
}
function findMatchingPatternWithBase(filePath, patternMap) {
  for (const [pattern, baseDir] of patternMap) {
    if (matchesGlobRelative(filePath, pattern, baseDir)) {
      return { pattern, baseDir };
    }
  }
  return null;
}

// ../../packages/privacy-redaction/src/exclusion/zest-rules-parser.ts
function parseZestRulesContent(content) {
  return parseGitignoreContent(content);
}
function createZestRulesResult(filePath, content) {
  const directory = filePath.replace(/[/\\][^/\\]*$/, "");
  const patterns = parseZestRulesContent(content);
  const globs = patterns.filter((p) => !p.negated).map((p) => p.glob);
  return {
    filePath,
    directory,
    patterns,
    globs
  };
}
function mergeZestRulesPatterns(results) {
  const patterns = new Set;
  for (const result of results) {
    for (const glob of result.globs) {
      patterns.add(glob);
    }
  }
  return patterns;
}
var ZEST_RULES_FILENAME = ".zest.rules";
var init_zest_rules_parser = () => {};

// ../../packages/privacy-redaction/src/exclusion/exclusion-service.ts
class FileExclusionService {
  config;
  fs;
  logger;
  builtInPatterns;
  gitignorePatterns;
  zestRulesPatterns;
  customPatterns;
  excludedFiles;
  initialized;
  constructor(options) {
    this.config = options.config;
    this.fs = options.fs;
    this.logger = options.logger;
    this.builtInPatterns = getBuiltInPatterns();
    this.gitignorePatterns = new Map;
    this.zestRulesPatterns = new Set;
    this.customPatterns = new Set(options.config.customExclusionPatterns);
    this.excludedFiles = new Map;
    this.initialized = false;
  }
  async initialize() {
    await this.refreshPatterns();
    this.initialized = true;
  }
  async refreshPatterns() {
    if (this.config.enableGitignore) {
      await this.loadGitignorePatterns();
    } else {
      this.gitignorePatterns.clear();
    }
    if (this.config.enableZestRules) {
      await this.loadZestRulesPatterns();
    } else {
      this.zestRulesPatterns.clear();
    }
    this.customPatterns = new Set(this.config.customExclusionPatterns);
    this.excludedFiles.clear();
  }
  async loadGitignorePatterns() {
    this.gitignorePatterns.clear();
    const workspaceRoot = this.fs.getWorkspaceRoot();
    if (!workspaceRoot)
      return;
    const results = [];
    const rootGitignore = `${workspaceRoot}/.gitignore`;
    try {
      if (await this.fs.fileExists(rootGitignore)) {
        const content = await this.fs.readFile(rootGitignore);
        results.push(createGitignoreResult(rootGitignore, content));
      }
    } catch (error) {
      this.logger?.debug(".gitignore unreadable; excluding without its patterns", error);
    }
    this.gitignorePatterns = mergeGitignorePatterns(results);
  }
  async loadZestRulesPatterns() {
    this.zestRulesPatterns.clear();
    const workspaceRoot = this.fs.getWorkspaceRoot();
    if (!workspaceRoot)
      return;
    const results = [];
    const rootZestRules = `${workspaceRoot}/${ZEST_RULES_FILENAME}`;
    try {
      if (await this.fs.fileExists(rootZestRules)) {
        const content = await this.fs.readFile(rootZestRules);
        results.push(createZestRulesResult(rootZestRules, content));
      }
    } catch (error) {
      this.logger?.debug(".zest.rules unreadable; excluding without its patterns", error);
    }
    this.zestRulesPatterns = mergeZestRulesPatterns(results);
  }
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await this.refreshPatterns();
  }
  getConfig() {
    return { ...this.config };
  }
  shouldExcludeFile(filePath) {
    const workspaceRoot = this.fs.getWorkspaceRoot();
    const builtInMatch = findMatchingPattern(filePath, this.builtInPatterns, workspaceRoot);
    if (builtInMatch) {
      const result = {
        excluded: true,
        reason: "built_in_rule",
        matchedRule: builtInMatch
      };
      this.trackExclusion(filePath, result);
      return result;
    }
    if (this.config.enableGitignore && this.gitignorePatterns.size > 0) {
      const gitignoreMatch = findMatchingPatternWithBase(filePath, this.gitignorePatterns);
      if (gitignoreMatch) {
        const result = {
          excluded: true,
          reason: "gitignore",
          matchedRule: gitignoreMatch.pattern
        };
        this.trackExclusion(filePath, result);
        return result;
      }
    }
    if (this.config.enableZestRules && this.zestRulesPatterns.size > 0) {
      const zestMatch = findMatchingPattern(filePath, this.zestRulesPatterns, workspaceRoot);
      if (zestMatch) {
        const result = {
          excluded: true,
          reason: "zest_rules",
          matchedRule: zestMatch
        };
        this.trackExclusion(filePath, result);
        return result;
      }
    }
    if (this.customPatterns.size > 0) {
      const customMatch = findMatchingPattern(filePath, this.customPatterns, workspaceRoot);
      if (customMatch) {
        const result = {
          excluded: true,
          reason: "custom_pattern",
          matchedRule: customMatch
        };
        this.trackExclusion(filePath, result);
        return result;
      }
    }
    return { excluded: false };
  }
  isFileTooLarge(fileSizeBytes) {
    return fileSizeBytes > this.config.maxFileSizeBytes;
  }
  isBinaryFile(filePath) {
    const binaryExtensions = [
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".obj",
      ".o",
      ".a",
      ".lib",
      ".jar",
      ".war",
      ".class",
      ".pyc",
      ".wasm",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".ico",
      ".webp",
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".mkv",
      ".mp3",
      ".wav",
      ".zip",
      ".tar",
      ".gz",
      ".rar",
      ".7z",
      ".pdf",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".db",
      ".sqlite",
      ".sqlite3"
    ];
    const lowerPath = filePath.toLowerCase();
    return binaryExtensions.some((ext) => lowerPath.endsWith(ext));
  }
  trackExclusion(filePath, result) {
    if (result.excluded && result.reason && result.matchedRule) {
      this.excludedFiles.set(filePath, {
        filePath,
        reason: result.reason,
        matchedRule: result.matchedRule
      });
    }
  }
  getExcludedFiles() {
    return Array.from(this.excludedFiles.values());
  }
  getStats() {
    const byReason = {
      built_in_rule: 0,
      gitignore: 0,
      zest_rules: 0,
      custom_pattern: 0,
      file_size: 0,
      binary_file: 0
    };
    for (const excluded of this.excludedFiles.values()) {
      byReason[excluded.reason]++;
    }
    return {
      totalExcluded: this.excludedFiles.size,
      byReason,
      gitignorePatternCount: this.gitignorePatterns.size,
      zestRulesPatternCount: this.zestRulesPatterns.size,
      builtInPatternCount: this.builtInPatterns.size
    };
  }
  clearExclusions() {
    this.excludedFiles.clear();
  }
  clearExclusionForFile(filePath) {
    this.excludedFiles.delete(filePath);
  }
  isInitialized() {
    return this.initialized;
  }
  getPatternCounts() {
    const counts = {
      builtIn: this.builtInPatterns.size,
      gitignore: this.gitignorePatterns.size,
      zestRules: this.zestRulesPatterns.size,
      custom: this.customPatterns.size,
      total: 0
    };
    counts.total = counts.builtIn + counts.gitignore + counts.zestRules + counts.custom;
    return counts;
  }
}
var init_exclusion_service = __esm(() => {
  init_built_in_rules();
  init_zest_rules_parser();
});

// ../../packages/privacy-redaction/src/exclusion/index.ts
var init_exclusion = __esm(() => {
  init_exclusion_service();
});

// ../../packages/privacy-redaction/src/redaction/redactor.ts
function redactContent(content, detections) {
  if (detections.length === 0) {
    return {
      redactedContent: content,
      detections: [],
      stats: {
        totalDetections: 0,
        byPattern: {}
      },
      wasRedacted: false
    };
  }
  const sortedDetections = [...detections].sort((a, b) => b.position.start - a.position.start);
  let redactedContent = content;
  const patternCounts = {};
  for (const detection of sortedDetections) {
    redactedContent = redactedContent.substring(0, detection.position.start) + REDACTED + redactedContent.substring(detection.position.end);
    patternCounts[detection.pattern] = (patternCounts[detection.pattern] || 0) + 1;
  }
  return {
    redactedContent,
    detections,
    stats: {
      totalDetections: detections.length,
      byPattern: patternCounts
    },
    wasRedacted: true
  };
}
var REDACTED = "[REDACTED]";

// ../../packages/privacy-redaction/src/redaction/index.ts
var init_redaction = () => {};

// ../../packages/privacy-redaction/src/privacy-service.ts
class PrivacyService {
  config;
  detector;
  exclusionService;
  filesProcessed;
  constructor(options) {
    this.config = createPrivacyConfig(options.config);
    const detectorOptions = {
      config: this.config,
      enableCache: options.enableCache ?? true,
      maxCacheEntries: options.maxCacheEntries,
      cacheTtlMs: options.cacheTtlMs
    };
    this.detector = new SensitiveDataDetector(detectorOptions);
    const exclusionOptions = {
      config: this.config,
      fs: options.fs,
      logger: options.logger
    };
    this.exclusionService = new FileExclusionService(exclusionOptions);
    this.filesProcessed = 0;
  }
  async initialize() {
    await this.exclusionService.initialize();
  }
  isInitialized() {
    return this.exclusionService.isInitialized();
  }
  processContent(content, filePath) {
    const scanResult = this.detector.scanContent(content, filePath);
    if (!scanResult.hasSensitiveData) {
      this.filesProcessed++;
      return {
        content,
        detections: [],
        hasSensitiveData: false,
        wasRedacted: false
      };
    }
    const redactionResult = redactContent(content, scanResult.detections);
    this.filesProcessed++;
    return {
      content: redactionResult.redactedContent,
      detections: redactionResult.detections,
      hasSensitiveData: true,
      wasRedacted: redactionResult.wasRedacted
    };
  }
  processContentIfNotExcluded(content, filePath) {
    const exclusion = this.shouldExcludeFile(filePath);
    if (exclusion.excluded) {
      return null;
    }
    return this.processContent(content, filePath);
  }
  scanContent(content, context) {
    const result = this.detector.scanContent(content, context);
    return result.detections;
  }
  hasSensitiveData(content) {
    const result = this.detector.scanContent(content);
    return result.hasSensitiveData;
  }
  hasHighlySensitiveData(content) {
    const result = this.detector.scanContent(content);
    if (!result.hasSensitiveData)
      return false;
    return this.detector.hasHighlySensitiveData(result.detections);
  }
  shouldExcludeFile(filePath) {
    return this.exclusionService.shouldExcludeFile(filePath);
  }
  isFileTooLarge(fileSizeBytes) {
    return this.exclusionService.isFileTooLarge(fileSizeBytes);
  }
  isBinaryFile(filePath) {
    return this.exclusionService.isBinaryFile(filePath);
  }
  async updateConfig(partial) {
    this.config = { ...this.config, ...partial };
    this.detector.updateConfig(partial);
    await this.exclusionService.updateConfig(partial);
  }
  getConfig() {
    return { ...this.config };
  }
  getStats() {
    const detectionStats = this.detector.getStats();
    const exclusionStats = this.exclusionService.getStats();
    return {
      detection: detectionStats,
      filesExcluded: exclusionStats.totalExcluded,
      filesProcessed: this.filesProcessed
    };
  }
  getExcludedFiles() {
    return this.exclusionService.getExcludedFiles();
  }
  clearAll() {
    this.detector.clearAll();
    this.exclusionService.clearExclusions();
    this.filesProcessed = 0;
  }
  clearCache() {
    this.detector.clearCache();
  }
  clearStats() {
    this.detector.clearStats();
    this.filesProcessed = 0;
  }
  clearExclusions() {
    this.exclusionService.clearExclusions();
  }
  async refreshExclusionPatterns() {
    await this.exclusionService.refreshPatterns();
  }
  getActivePatternCount() {
    return this.detector.getActivePatternCount();
  }
  getExclusionPatternCounts() {
    return this.exclusionService.getPatternCounts();
  }
  getCacheSize() {
    return this.detector.getCacheSize();
  }
}
var init_privacy_service = __esm(() => {
  init_defaults();
  init_detection();
  init_exclusion();
  init_redaction();
});

// ../../packages/privacy-redaction/src/redact-text.ts
function redactText(text) {
  const { detections } = detector.scanContent(text);
  if (detections.length === 0)
    return { text, count: 0, byPattern: {} };
  const { redactedContent, stats } = redactContent(text, detections);
  return { text: redactedContent, count: stats.totalDetections, byPattern: stats.byPattern };
}
var config2, detector;
var init_redact_text = __esm(() => {
  init_defaults();
  init_detection();
  init_redaction();
  init_patterns();
  config2 = createPrivacyConfig();
  detector = new SensitiveDataDetector({ config: config2, enableCache: false });
});

// ../../packages/privacy-redaction/src/manager/node-fs-adapter.ts
import { readdir as readdir4, readFile as readFile9, stat as stat2 } from "node:fs/promises";
function createNodeFsAdapter(workspaceRoot) {
  return {
    async readFile(path) {
      return readFile9(path, "utf-8");
    },
    async fileExists(path) {
      try {
        await stat2(path);
        return true;
      } catch {
        return false;
      }
    },
    async readDir(path) {
      return readdir4(path);
    },
    getWorkspaceRoot() {
      return workspaceRoot;
    }
  };
}
var init_node_fs_adapter = () => {};

// ../../packages/privacy-redaction/src/manager/privacy-manager.ts
class PrivacyManager {
  service = null;
  initialized = false;
  projectDir;
  logger;
  async initialize(options) {
    const projectDir = options?.projectDir;
    const settings = options?.settings;
    if (options?.logger) {
      this.logger = options.logger;
    }
    if (this.initialized && this.projectDir === projectDir) {
      this.logger?.debug("Privacy manager already initialized for this project");
      return;
    }
    this.projectDir = projectDir;
    const config = this.settingsToConfig(settings);
    this.service = new PrivacyService({
      config,
      fs: createNodeFsAdapter(projectDir),
      enableCache: true,
      logger: this.logger
    });
    await this.service.initialize();
    this.initialized = true;
    this.logger?.debug("Privacy manager initialized", {
      projectDir,
      patternCount: this.service.getActivePatternCount(),
      exclusionCounts: this.service.getExclusionPatternCounts()
    });
  }
  isInitialized() {
    return this.initialized && this.service !== null;
  }
  processContent(content, filePath) {
    if (!this.service || !this.initialized) {
      const { text, count } = redactText(content);
      return {
        content: text,
        detections: [],
        hasSensitiveData: count > 0,
        wasRedacted: count > 0
      };
    }
    return this.service.processContent(content, filePath);
  }
  redactMessage(content) {
    if (!this.service || !this.initialized) {
      return redactText(content).text;
    }
    const result = this.service.processContent(content);
    if (result.wasRedacted) {
      this.logger?.debug("Redacted sensitive data from message", {
        detections: result.detections.length,
        patterns: result.detections.map((d) => d.pattern)
      });
    }
    return result.content;
  }
  redactDiff(diff, filePath) {
    if (!this.service || !this.initialized) {
      return redactText(diff).text;
    }
    const result = this.service.processContent(diff, filePath);
    if (result.wasRedacted) {
      this.logger?.debug("Redacted sensitive data from diff", {
        filePath,
        detections: result.detections.length
      });
    }
    return result.content;
  }
  shouldExcludeFile(filePath) {
    if (!this.service || !this.initialized) {
      return false;
    }
    const result = this.service.shouldExcludeFile(filePath);
    if (result.excluded) {
      this.logger?.debug("File excluded from telemetry", {
        filePath,
        reason: result.reason,
        matchedRule: result.matchedRule
      });
    }
    return result.excluded;
  }
  async updateSettings(settings) {
    if (!this.service) {
      this.logger?.warn("Cannot update settings: Privacy manager not initialized");
      return;
    }
    const config = this.settingsToConfig(settings);
    await this.service.updateConfig(config);
    this.logger?.debug("Privacy settings updated", settings);
  }
  getStats() {
    if (!this.service || !this.initialized) {
      return null;
    }
    const stats = this.service.getStats();
    return {
      totalDetections: stats.detection.totalDetections,
      filesProcessed: stats.filesProcessed,
      filesExcluded: stats.filesExcluded
    };
  }
  reset() {
    if (this.service) {
      this.service.clearAll();
    }
    this.initialized = false;
    this.projectDir = undefined;
    this.logger?.debug("Privacy manager reset");
  }
  settingsToConfig(settings) {
    if (!settings) {
      return {};
    }
    return {
      approach: settings.approach,
      aggressiveMode: settings.aggressiveMode,
      enableGitignore: settings.enableGitignore,
      enableZestRules: settings.enableZestRules,
      customExclusionPatterns: settings.customExclusionPatterns
    };
  }
}
var PrivacySettingsSchema, DEFAULT_PRIVACY_SETTINGS;
var init_privacy_manager = __esm(() => {
  init_zod();
  init_privacy_service();
  init_redact_text();
  init_node_fs_adapter();
  PrivacySettingsSchema = object({
    approach: preprocess((value) => value === "encrypt" || value === "hash" ? "encryption" : value, _enum(["detection", "encryption", "hybrid"])).default("detection"),
    aggressiveMode: boolean2().default(false),
    enableGitignore: boolean2().default(true),
    enableZestRules: boolean2().default(true),
    customExclusionPatterns: array(string2()).default([])
  });
  DEFAULT_PRIVACY_SETTINGS = {
    approach: "detection",
    aggressiveMode: false,
    enableGitignore: true,
    enableZestRules: true,
    customExclusionPatterns: []
  };
});

// ../../node_modules/.bun/is-docker@3.0.0/node_modules/is-docker/index.js
import fs from "node:fs";
function hasDockerEnv() {
  try {
    fs.statSync("/.dockerenv");
    return true;
  } catch {
    return false;
  }
}
function hasDockerCGroup() {
  try {
    return fs.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
  } catch {
    return false;
  }
}
function isDocker() {
  if (isDockerCached === undefined) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }
  return isDockerCached;
}
var isDockerCached;
var init_is_docker = () => {};

// ../../node_modules/.bun/is-inside-container@1.0.0/node_modules/is-inside-container/index.js
import fs2 from "node:fs";
function isInsideContainer() {
  if (cachedResult === undefined) {
    cachedResult = hasContainerEnv() || isDocker();
  }
  return cachedResult;
}
var cachedResult, hasContainerEnv = () => {
  try {
    fs2.statSync("/run/.containerenv");
    return true;
  } catch {
    return false;
  }
};
var init_is_inside_container = __esm(() => {
  init_is_docker();
});

// ../../node_modules/.bun/is-wsl@3.1.1/node_modules/is-wsl/index.js
import process2 from "node:process";
import os from "node:os";
import fs3 from "node:fs";
var isWsl = () => {
  if (process2.platform !== "linux") {
    return false;
  }
  if (os.release().toLowerCase().includes("microsoft")) {
    if (isInsideContainer()) {
      return false;
    }
    return true;
  }
  try {
    if (fs3.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft")) {
      return !isInsideContainer();
    }
  } catch {}
  if (fs3.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop") || fs3.existsSync("/run/WSL")) {
    return !isInsideContainer();
  }
  return false;
}, is_wsl_default;
var init_is_wsl = __esm(() => {
  init_is_inside_container();
  is_wsl_default = process2.env.__IS_WSL_TEST__ ? isWsl : isWsl();
});

// ../../node_modules/.bun/wsl-utils@0.1.0/node_modules/wsl-utils/index.js
import process3 from "node:process";
import fs4, { constants as fsConstants } from "node:fs/promises";
var wslDrivesMountPoint, powerShellPathFromWsl = async () => {
  const mountPoint = await wslDrivesMountPoint();
  return `${mountPoint}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`;
}, powerShellPath = async () => {
  if (is_wsl_default) {
    return powerShellPathFromWsl();
  }
  return `${process3.env.SYSTEMROOT || process3.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
};
var init_wsl_utils = __esm(() => {
  init_is_wsl();
  init_is_wsl();
  wslDrivesMountPoint = (() => {
    const defaultMountPoint = "/mnt/";
    let mountPoint;
    return async function() {
      if (mountPoint) {
        return mountPoint;
      }
      const configFilePath = "/etc/wsl.conf";
      let isConfigFileExists = false;
      try {
        await fs4.access(configFilePath, fsConstants.F_OK);
        isConfigFileExists = true;
      } catch {}
      if (!isConfigFileExists) {
        return defaultMountPoint;
      }
      const configContent = await fs4.readFile(configFilePath, { encoding: "utf8" });
      const configMountPoint = /(?<!#.*)root\s*=\s*(?<mountPoint>.*)/g.exec(configContent);
      if (!configMountPoint) {
        return defaultMountPoint;
      }
      mountPoint = configMountPoint.groups.mountPoint.trim();
      mountPoint = mountPoint.endsWith("/") ? mountPoint : `${mountPoint}/`;
      return mountPoint;
    };
  })();
});

// ../../node_modules/.bun/define-lazy-prop@3.0.0/node_modules/define-lazy-prop/index.js
function defineLazyProperty(object, propertyName, valueGetter) {
  const define = (value) => Object.defineProperty(object, propertyName, { value, enumerable: true, writable: true });
  Object.defineProperty(object, propertyName, {
    configurable: true,
    enumerable: true,
    get() {
      const result = valueGetter();
      define(result);
      return result;
    },
    set(value) {
      define(value);
    }
  });
  return object;
}

// ../../node_modules/.bun/default-browser-id@5.0.1/node_modules/default-browser-id/index.js
import { promisify as promisify2 } from "node:util";
import process4 from "node:process";
import { execFile } from "node:child_process";
async function defaultBrowserId() {
  if (process4.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const { stdout } = await execFileAsync("defaults", ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"]);
  const match = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(stdout);
  const browserId = match?.groups.id ?? "com.apple.Safari";
  if (browserId === "com.apple.safari") {
    return "com.apple.Safari";
  }
  return browserId;
}
var execFileAsync;
var init_default_browser_id = __esm(() => {
  execFileAsync = promisify2(execFile);
});

// ../../node_modules/.bun/run-applescript@7.1.0/node_modules/run-applescript/index.js
import process5 from "node:process";
import { promisify as promisify3 } from "node:util";
import { execFile as execFile2, execFileSync } from "node:child_process";
async function runAppleScript(script, { humanReadableOutput = true, signal } = {}) {
  if (process5.platform !== "darwin") {
    throw new Error("macOS only");
  }
  const outputArguments = humanReadableOutput ? [] : ["-ss"];
  const execOptions = {};
  if (signal) {
    execOptions.signal = signal;
  }
  const { stdout } = await execFileAsync2("osascript", ["-e", script, outputArguments], execOptions);
  return stdout.trim();
}
var execFileAsync2;
var init_run_applescript = __esm(() => {
  execFileAsync2 = promisify3(execFile2);
});

// ../../node_modules/.bun/bundle-name@4.1.0/node_modules/bundle-name/index.js
async function bundleName(bundleId) {
  return runAppleScript(`tell application "Finder" to set app_path to application file id "${bundleId}" as string
tell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}
var init_bundle_name = __esm(() => {
  init_run_applescript();
});

// ../../node_modules/.bun/default-browser@5.5.0/node_modules/default-browser/windows.js
import { promisify as promisify4 } from "node:util";
import { execFile as execFile3 } from "node:child_process";
async function defaultBrowser(_execFileAsync = execFileAsync3) {
  const { stdout } = await _execFileAsync("reg", [
    "QUERY",
    " HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
    "/v",
    "ProgId"
  ]);
  const match = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(stdout);
  if (!match) {
    throw new UnknownBrowserError(`Cannot find Windows browser in stdout: ${JSON.stringify(stdout)}`);
  }
  const { id } = match.groups;
  const dotIndex = id.lastIndexOf(".");
  const hyphenIndex = id.lastIndexOf("-");
  const baseIdByDot = dotIndex === -1 ? undefined : id.slice(0, dotIndex);
  const baseIdByHyphen = hyphenIndex === -1 ? undefined : id.slice(0, hyphenIndex);
  return windowsBrowserProgIds[id] ?? windowsBrowserProgIds[baseIdByDot] ?? windowsBrowserProgIds[baseIdByHyphen] ?? { name: id, id };
}
var execFileAsync3, windowsBrowserProgIds, _windowsBrowserProgIdMap, UnknownBrowserError;
var init_windows = __esm(() => {
  execFileAsync3 = promisify4(execFile3);
  windowsBrowserProgIds = {
    MSEdgeHTM: { name: "Edge", id: "com.microsoft.edge" },
    MSEdgeBHTML: { name: "Edge Beta", id: "com.microsoft.edge.beta" },
    MSEdgeDHTML: { name: "Edge Dev", id: "com.microsoft.edge.dev" },
    AppXq0fevzme2pys62n3e0fbqa7peapykr8v: { name: "Edge", id: "com.microsoft.edge.old" },
    ChromeHTML: { name: "Chrome", id: "com.google.chrome" },
    ChromeBHTML: { name: "Chrome Beta", id: "com.google.chrome.beta" },
    ChromeDHTML: { name: "Chrome Dev", id: "com.google.chrome.dev" },
    ChromiumHTM: { name: "Chromium", id: "org.chromium.Chromium" },
    BraveHTML: { name: "Brave", id: "com.brave.Browser" },
    BraveBHTML: { name: "Brave Beta", id: "com.brave.Browser.beta" },
    BraveDHTML: { name: "Brave Dev", id: "com.brave.Browser.dev" },
    BraveSSHTM: { name: "Brave Nightly", id: "com.brave.Browser.nightly" },
    FirefoxURL: { name: "Firefox", id: "org.mozilla.firefox" },
    OperaStable: { name: "Opera", id: "com.operasoftware.Opera" },
    VivaldiHTM: { name: "Vivaldi", id: "com.vivaldi.Vivaldi" },
    "IE.HTTP": { name: "Internet Explorer", id: "com.microsoft.ie" }
  };
  _windowsBrowserProgIdMap = new Map(Object.entries(windowsBrowserProgIds));
  UnknownBrowserError = class UnknownBrowserError extends Error {
  };
});

// ../../node_modules/.bun/default-browser@5.5.0/node_modules/default-browser/index.js
import { promisify as promisify5 } from "node:util";
import process6 from "node:process";
import { execFile as execFile4 } from "node:child_process";
async function defaultBrowser2() {
  if (process6.platform === "darwin") {
    const id = await defaultBrowserId();
    const name = await bundleName(id);
    return { name, id };
  }
  if (process6.platform === "linux") {
    const { stdout } = await execFileAsync4("xdg-mime", ["query", "default", "x-scheme-handler/http"]);
    const id = stdout.trim();
    const name = titleize(id.replace(/.desktop$/, "").replace("-", " "));
    return { name, id };
  }
  if (process6.platform === "win32") {
    return defaultBrowser();
  }
  throw new Error("Only macOS, Linux, and Windows are supported");
}
var execFileAsync4, titleize = (string) => string.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (x) => x.toUpperCase());
var init_default_browser = __esm(() => {
  init_default_browser_id();
  init_bundle_name();
  init_windows();
  execFileAsync4 = promisify5(execFile4);
});

// ../../node_modules/.bun/open@10.2.0/node_modules/open/index.js
import process7 from "node:process";
import { Buffer as Buffer2 } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify as promisify6 } from "node:util";
import childProcess from "node:child_process";
import fs5, { constants as fsConstants2 } from "node:fs/promises";
async function getWindowsDefaultBrowserFromWsl() {
  const powershellPath = await powerShellPath();
  const rawCommand = String.raw`(Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice").ProgId`;
  const encodedCommand = Buffer2.from(rawCommand, "utf16le").toString("base64");
  const { stdout } = await execFile5(powershellPath, [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    encodedCommand
  ], { encoding: "utf8" });
  const progId = stdout.trim();
  const browserMap = {
    ChromeHTML: "com.google.chrome",
    BraveHTML: "com.brave.Browser",
    MSEdgeHTM: "com.microsoft.edge",
    FirefoxURL: "org.mozilla.firefox"
  };
  return browserMap[progId] ? { id: browserMap[progId] } : {};
}
function detectArchBinary(binary) {
  if (typeof binary === "string" || Array.isArray(binary)) {
    return binary;
  }
  const { [arch2]: archBinary } = binary;
  if (!archBinary) {
    throw new Error(`${arch2} is not supported`);
  }
  return archBinary;
}
function detectPlatformBinary({ [platform3]: platformBinary }, { wsl }) {
  if (wsl && is_wsl_default) {
    return detectArchBinary(wsl);
  }
  if (!platformBinary) {
    throw new Error(`${platform3} is not supported`);
  }
  return detectArchBinary(platformBinary);
}
var execFile5, __dirname2, localXdgOpenPath, platform3, arch2, pTryEach = async (array, mapper) => {
  let latestError;
  for (const item of array) {
    try {
      return await mapper(item);
    } catch (error) {
      latestError = error;
    }
  }
  throw latestError;
}, baseOpen = async (options) => {
  options = {
    wait: false,
    background: false,
    newInstance: false,
    allowNonzeroExitCode: false,
    ...options
  };
  if (Array.isArray(options.app)) {
    return pTryEach(options.app, (singleApp) => baseOpen({
      ...options,
      app: singleApp
    }));
  }
  let { name: app, arguments: appArguments = [] } = options.app ?? {};
  appArguments = [...appArguments];
  if (Array.isArray(app)) {
    return pTryEach(app, (appName) => baseOpen({
      ...options,
      app: {
        name: appName,
        arguments: appArguments
      }
    }));
  }
  if (app === "browser" || app === "browserPrivate") {
    const ids = {
      "com.google.chrome": "chrome",
      "google-chrome.desktop": "chrome",
      "com.brave.Browser": "brave",
      "org.mozilla.firefox": "firefox",
      "firefox.desktop": "firefox",
      "com.microsoft.msedge": "edge",
      "com.microsoft.edge": "edge",
      "com.microsoft.edgemac": "edge",
      "microsoft-edge.desktop": "edge"
    };
    const flags = {
      chrome: "--incognito",
      brave: "--incognito",
      firefox: "--private-window",
      edge: "--inPrivate"
    };
    const browser = is_wsl_default ? await getWindowsDefaultBrowserFromWsl() : await defaultBrowser2();
    if (browser.id in ids) {
      const browserName = ids[browser.id];
      if (app === "browserPrivate") {
        appArguments.push(flags[browserName]);
      }
      return baseOpen({
        ...options,
        app: {
          name: apps[browserName],
          arguments: appArguments
        }
      });
    }
    throw new Error(`${browser.name} is not supported as a default browser`);
  }
  let command;
  const cliArguments = [];
  const childProcessOptions = {};
  if (platform3 === "darwin") {
    command = "open";
    if (options.wait) {
      cliArguments.push("--wait-apps");
    }
    if (options.background) {
      cliArguments.push("--background");
    }
    if (options.newInstance) {
      cliArguments.push("--new");
    }
    if (app) {
      cliArguments.push("-a", app);
    }
  } else if (platform3 === "win32" || is_wsl_default && !isInsideContainer() && !app) {
    command = await powerShellPath();
    cliArguments.push("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand");
    if (!is_wsl_default) {
      childProcessOptions.windowsVerbatimArguments = true;
    }
    const encodedArguments = ["Start"];
    if (options.wait) {
      encodedArguments.push("-Wait");
    }
    if (app) {
      encodedArguments.push(`"\`"${app}\`""`);
      if (options.target) {
        appArguments.push(options.target);
      }
    } else if (options.target) {
      encodedArguments.push(`"${options.target}"`);
    }
    if (appArguments.length > 0) {
      appArguments = appArguments.map((argument) => `"\`"${argument}\`""`);
      encodedArguments.push("-ArgumentList", appArguments.join(","));
    }
    options.target = Buffer2.from(encodedArguments.join(" "), "utf16le").toString("base64");
  } else {
    if (app) {
      command = app;
    } else {
      const isBundled = !__dirname2 || __dirname2 === "/";
      let exeLocalXdgOpen = false;
      try {
        await fs5.access(localXdgOpenPath, fsConstants2.X_OK);
        exeLocalXdgOpen = true;
      } catch {}
      const useSystemXdgOpen = process7.versions.electron ?? (platform3 === "android" || isBundled || !exeLocalXdgOpen);
      command = useSystemXdgOpen ? "xdg-open" : localXdgOpenPath;
    }
    if (appArguments.length > 0) {
      cliArguments.push(...appArguments);
    }
    if (!options.wait) {
      childProcessOptions.stdio = "ignore";
      childProcessOptions.detached = true;
    }
  }
  if (platform3 === "darwin" && appArguments.length > 0) {
    cliArguments.push("--args", ...appArguments);
  }
  if (options.target) {
    cliArguments.push(options.target);
  }
  const subprocess = childProcess.spawn(command, cliArguments, childProcessOptions);
  if (options.wait) {
    return new Promise((resolve, reject) => {
      subprocess.once("error", reject);
      subprocess.once("close", (exitCode) => {
        if (!options.allowNonzeroExitCode && exitCode > 0) {
          reject(new Error(`Exited with code ${exitCode}`));
          return;
        }
        resolve(subprocess);
      });
    });
  }
  subprocess.unref();
  return subprocess;
}, open3 = (target, options) => {
  if (typeof target !== "string") {
    throw new TypeError("Expected a `target`");
  }
  return baseOpen({
    ...options,
    target
  });
}, apps, open_default;
var init_open = __esm(() => {
  init_wsl_utils();
  init_default_browser();
  init_is_inside_container();
  execFile5 = promisify6(childProcess.execFile);
  __dirname2 = path.dirname(fileURLToPath(import.meta.url));
  localXdgOpenPath = path.join(__dirname2, "xdg-open");
  ({ platform: platform3, arch: arch2 } = process7);
  apps = {};
  defineLazyProperty(apps, "chrome", () => detectPlatformBinary({
    darwin: "google chrome",
    win32: "chrome",
    linux: ["google-chrome", "google-chrome-stable", "chromium"]
  }, {
    wsl: {
      ia32: "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      x64: ["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe", "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
    }
  }));
  defineLazyProperty(apps, "brave", () => detectPlatformBinary({
    darwin: "brave browser",
    win32: "brave",
    linux: ["brave-browser", "brave"]
  }, {
    wsl: {
      ia32: "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
      x64: ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"]
    }
  }));
  defineLazyProperty(apps, "firefox", () => detectPlatformBinary({
    darwin: "firefox",
    win32: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`,
    linux: "firefox"
  }, {
    wsl: "/mnt/c/Program Files/Mozilla Firefox/firefox.exe"
  }));
  defineLazyProperty(apps, "edge", () => detectPlatformBinary({
    darwin: "microsoft edge",
    win32: "msedge",
    linux: ["microsoft-edge", "microsoft-edge-dev"]
  }, {
    wsl: "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  }));
  defineLazyProperty(apps, "browser", () => "browser");
  defineLazyProperty(apps, "browserPrivate", () => "browserPrivate");
  open_default = open3;
});

// src/runtime.ts
import { join as join9 } from "node:path";
var runtime, logger2, flushLogs2, captureException, zest, privacyManager, withFileLock, readQueue, atomicUpdateQueue, initializeQueue, enqueueChatSession, enqueueChatMessage, getQueueStats, getDetailedQueueStats, readStatusCache, writeSyncStatus, clearSyncError, markStuckAlerted, acknowledgeLegacyQueueDrop, recordSyncMetric, getLastHourMetrics, aggregateLastHourStats, readRuntimeEnvSnapshot, loadRuntimeEnvIntoProcess, snapshotRuntimeEnv;
var init_runtime = __esm(() => {
  init_plugin_runtime();
  init_privacy_manager();
  init_open();
  init_constants();
  runtime = createPluginRuntime({
    root: FREEBUFF_ZEST_DIR,
    clientId: CLIENT_ID,
    logPrefix: "Zest:Freebuff",
    logToConsole: false,
    privacyManager: new PrivacyManager,
    minMessagesPerSession: MIN_MESSAGES_PER_SESSION,
    lockMaxRetries: 40,
    posthogApiKey: POSTHOG_API_KEY,
    packageJson: () => join9(import.meta.dirname, "..", "package.json"),
    openBrowser: async (url) => open_default(url, { wait: false })
  });
  ({
    logger: logger2,
    flushLogs: flushLogs2,
    captureException,
    zest,
    privacyManager,
    withFileLock,
    readQueue,
    atomicUpdateQueue,
    initializeQueue,
    enqueueChatSession,
    enqueueChatMessage,
    getQueueStats,
    getDetailedQueueStats,
    readStatusCache,
    writeSyncStatus,
    clearSyncError,
    markStuckAlerted,
    acknowledgeLegacyQueueDrop,
    recordSyncMetric,
    getLastHourMetrics,
    aggregateLastHourStats,
    readRuntimeEnvSnapshot,
    loadRuntimeEnvIntoProcess,
    snapshotRuntimeEnv
  } = runtime);
});

// ../../packages/plugin-common/src/service/login-service.ts
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join as join10 } from "node:path";
function loginServiceFor({ label, unit }, o, exec = run) {
  if (o.platform === "darwin") {
    const domain = `gui/${o.uid}`;
    const target = `${domain}/${label}`;
    const file = join10(o.home, "Library", "LaunchAgents", `${label}.plist`);
    return {
      file,
      manageable: true,
      unload: [["launchctl", ["bootout", target]]],
      loaded: ["launchctl", ["print", target]],
      manualUnload: `launchctl bootout ${target}`
    };
  }
  if (o.platform === "linux") {
    return {
      file: join10(o.home, ".config", "systemd", "user", unit),
      manageable: exec("systemctl", ["--user", "show-environment"]).status === 0,
      unload: [["systemctl", ["--user", "disable", "--now", unit]]],
      loaded: ["systemctl", ["--user", "is-active", "--quiet", unit]],
      manualUnload: `systemctl --user disable --now ${unit}`
    };
  }
  return null;
}
async function removeLoginService(service, exec = run, retryMs = 1000) {
  if (!service || !existsSync(service.file))
    return null;
  if (!service.manageable)
    return service.manualUnload;
  for (const [command, args] of service.unload)
    exec(command, args);
  let loaded = exec(...service.loaded).status === 0;
  for (let attempt = 1;loaded && attempt < 5; attempt++) {
    await sleep(retryMs);
    loaded = exec(...service.loaded).status === 0;
  }
  if (loaded)
    return service.manualUnload;
  await rm(service.file, { force: true });
  return null;
}
var run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf-8" });
  return { status: result.status, stderr: result.error?.message ?? result.stderr ?? "" };
}, sleep = (ms) => new Promise((done) => setTimeout(done, ms));
var init_login_service = () => {};

// src/service/login-service.ts
var SERVICE_LABEL = "com.meetzest.freebuff", loginServiceFor2 = (o, exec = run) => loginServiceFor({ label: SERVICE_LABEL, unit: "zest-freebuff.service" }, o, exec);
var init_login_service2 = __esm(() => {
  init_login_service();
  init_login_service();
});

// ../../packages/plugin-common/src/service/shell-path.ts
import { existsSync as existsSync2, realpathSync, statSync } from "node:fs";
import { chmod as chmod3, readFile as readFile10, realpath, rename as rename2, stat as stat3, writeFile as writeFile6 } from "node:fs/promises";
import { delimiter, join as join11 } from "node:path";
function shQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function shimScript({ name, header, start }) {
  return `#!/bin/sh
${header}
unset CDPATH
here=$(cd "$(dirname "$0")" && pwd -P)
real=
set -f
IFS=:
for dir in $PATH; do
  [ -n "$dir" ] || continue
  [ "$(cd "$dir" 2>/dev/null && pwd -P)" = "$here" ] && continue
  if [ -f "$dir/${name}" ] && [ -x "$dir/${name}" ]; then real=$dir/${name}; break; fi
done
unset IFS
set +f
if [ -z "$real" ]; then
  echo "${name}: command not found (only the Zest shim is on PATH)" >&2
  exit 127
fi
${start}
exec "$real" "$@"
`;
}
function allRcFiles(home, zdotdir = home) {
  return [
    join11(zdotdir, ".zshrc"),
    join11(home, ".bashrc"),
    ...[".bash_profile", ".bash_login", ".profile"].map((name) => join11(home, name))
  ];
}
function rcFilesFor(home, shell, platform, zdotdir = home) {
  const [zshrc, bashrc, ...bashLogin] = allRcFiles(home, zdotdir);
  const login = bashLogin.find((file) => existsSync2(file));
  const own = shell?.endsWith("/zsh") ? zshrc : shell?.endsWith("/bash") ? platform === "darwin" ? login ?? bashLogin[0] : bashrc : null;
  return [zshrc, bashrc, login ?? bashLogin[0]].filter((file) => file !== undefined && (existsSync2(file) || file === own));
}
async function readIfExists(file) {
  try {
    return await readFile10(file, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT")
      return "";
    throw error;
  }
}
async function replaceFile(file, content, tag) {
  const target = existsSync2(file) ? await realpath(file) : file;
  const mode = await stat3(target).then((info) => info.mode & 4095, (error) => {
    if (error.code === "ENOENT")
      return 384;
    throw error;
  });
  const tmp = `${target}.${tag}.${process.pid}.tmp`;
  await writeFile6(tmp, content, { encoding: "utf-8", mode, flag: "w" });
  await chmod3(tmp, mode);
  await rename2(tmp, target);
}
function fencedBlocks(id) {
  const blockStart = `# >>> ${id} >>>`;
  const blockEnd = `# <<< ${id} <<<`;
  const wrap = (body) => `${blockStart}
${body}${blockEnd}
`;
  const strip = (content) => {
    let rest = content;
    for (;; ) {
      const start = rest.indexOf(blockStart);
      const end = rest.indexOf(blockEnd, start);
      if (start === -1 || end === -1)
        return rest;
      rest = rest.slice(0, start) + rest.slice(end + blockEnd.length).replace(/^\n/, "");
    }
  };
  return {
    wrap,
    async add(file, body) {
      const content = strip(await readIfExists(file));
      const separator = content === "" || content.endsWith(`
`) ? "" : `
`;
      await replaceFile(file, `${content}${separator}${wrap(body)}`, id);
    },
    async has(file) {
      const content = await readIfExists(file);
      const start = content.indexOf(blockStart);
      return start !== -1 && content.indexOf(blockEnd, start) !== -1;
    },
    async remove(file) {
      const content = await readIfExists(file);
      const stripped = strip(content);
      if (stripped === content)
        return false;
      await replaceFile(file, stripped, id);
      return true;
    }
  };
}
function pathBlocks(id) {
  const blocks = fencedBlocks(id);
  const line = (shimDir) => `export PATH=${shQuote(shimDir)}:"$PATH"
`;
  return {
    pathBlock: (shimDir) => blocks.wrap(line(shimDir)),
    addPathBlock: (file, shimDir) => blocks.add(file, line(shimDir)),
    removePathBlock: (file) => blocks.remove(file)
  };
}
function firstOnPath(name, path = process.env.PATH ?? "") {
  for (const dir of path.split(delimiter)) {
    if (!dir)
      continue;
    const candidate = join11(dir, name);
    try {
      if (statSync(candidate).isFile())
        return realpathSync(candidate);
    } catch (error) {
      logHandled(`${name} not in a PATH entry; trying the next`, error);
    }
  }
  return null;
}
var init_shell_path = () => {};

// src/service/shell-shim.ts
function shimScript2(node, cli) {
  return shimScript({
    name: "freebuff",
    header: `# ${SHIM_MARKER} — written by \`zest-freebuff install\`, removed by \`zest-freebuff uninstall\``,
    start: `node=${shQuote(node)}
[ -x "$node" ] || node=$(command -v node) || node=
[ -z "$node" ] || ( "$node" ${shQuote(cli)} watch --host $$ </dev/null >/dev/null 2>&1 & )`
  });
}
var SHIM_MARKER = "zest-freebuff shim", pathBlock, addPathBlock, removePathBlock;
var init_shell_shim = __esm(() => {
  init_shell_path();
  init_shell_path();
  ({ pathBlock, addPathBlock, removePathBlock } = pathBlocks("zest-freebuff"));
});

// src/slash/user-commands.ts
function userSyncNextAction() {
  return `Run ${USER_SYNC}, or wait — capture retries while the watcher runs.`;
}
var ZEST_FREEBUFF_CLI = "npx -y --allow-git=root github:Winding-Labs/zest-freebuff", USER_INSTALL, USER_LOGIN, USER_SYNC, USER_WATCH, USER_WORKSPACE, USER_ENABLE, USER_UNIGNORE, NOT_AUTHENTICATED_MESSAGE;
var init_user_commands = __esm(() => {
  USER_INSTALL = `${ZEST_FREEBUFF_CLI} install`;
  USER_LOGIN = `${ZEST_FREEBUFF_CLI} login`;
  USER_SYNC = `${ZEST_FREEBUFF_CLI} sync`;
  USER_WATCH = `${ZEST_FREEBUFF_CLI} watch`;
  USER_WORKSPACE = `${ZEST_FREEBUFF_CLI} workspace`;
  USER_ENABLE = `${ZEST_FREEBUFF_CLI} enable`;
  USER_UNIGNORE = `${ZEST_FREEBUFF_CLI} unignore`;
  NOT_AUTHENTICATED_MESSAGE = `Not authenticated — run ${USER_LOGIN}`;
});

// ../../packages/plugin-common/src/capture/capture-outcome.ts
function toSyncErrorType(status) {
  switch (status) {
    case "not_authenticated":
      return "not_authenticated";
    case "parse_error":
    case "identity_mismatch":
    case "no_workspace":
      return "extraction_failed";
    case "privacy_init_failed":
    case "settings_invalid":
      return "privacy_init_failed";
    case "ok":
    case "no_sessions":
    case "excluded":
      return null;
  }
  const _exhaustive = status;
  return _exhaustive;
}
function capturePausesSync(status) {
  return status === "not_authenticated" || status === "settings_invalid";
}
function settingsInvalid(error) {
  return {
    status: "settings_invalid",
    sessionsProcessed: 0,
    message: describeError(error)
  };
}
function createCaptureOutcome(config) {
  const { logger, recordSyncMetric, readStatusCache, writeSyncStatus } = config;
  async function recordCaptureOutcome(result) {
    const errorType = toSyncErrorType(result.status);
    if (!errorType) {
      const previous = readStatusCache().syncStatus;
      if (previous.errorType && CAPTURE_ERRORS.has(previous.errorType)) {
        await writeSyncStatus({
          hasError: false,
          errorType: null,
          errorMessage: null,
          lastErrorAt: null,
          lastSuccessAt: previous.lastSuccessAt
        });
      }
      return;
    }
    await recordSyncMetric({
      timestamp: Date.now(),
      success: false,
      uploaded: { sessions: 0, messages: 0 },
      errorType
    });
    await writeSyncStatus({
      hasError: true,
      errorType,
      errorMessage: result.message,
      lastErrorAt: Date.now(),
      lastSuccessAt: null
    }).catch((cacheError) => logger.error("Failed to write sync error to status cache", cacheError));
  }
  async function clearUploadError() {
    const errorType = readStatusCache().syncStatus.errorType;
    if (!errorType || !CAPTURE_ERRORS.has(errorType))
      await config.clearSyncError();
  }
  return { recordCaptureOutcome, clearUploadError };
}
var CAPTURE_ERRORS;
var init_capture_outcome = __esm(() => {
  CAPTURE_ERRORS = new Set([
    "extraction_failed",
    "privacy_init_failed"
  ]);
});

// ../../packages/plugin-common/src/collector/hosts.ts
import { mkdir as mkdir5, readdir as readdir5, readFile as readFile11, rm as rm2, writeFile as writeFile7 } from "node:fs/promises";
import { join as join12 } from "node:path";
async function registerHost(dir, pid, harness = "") {
  await mkdir5(dir, { recursive: true });
  await writeFile7(join12(dir, String(pid)), harness);
}
async function liveHosts(dir, harness) {
  let names;
  try {
    names = await readdir5(dir);
  } catch (error) {
    logHandled("hosts folder missing or unreadable; no live hosts", error);
    return [];
  }
  const live = [];
  for (const name of names) {
    const pid = Number.parseInt(name, 10);
    if (!isProcessAlive(pid))
      await rm2(join12(dir, name), { force: true });
    else if (harness === undefined || await readFile11(join12(dir, name), "utf-8").catch(() => "") === harness)
      live.push(pid);
  }
  return live;
}
var isAlive;
var init_hosts = __esm(() => {
  init_processes();
  isAlive = isProcessAlive;
});

// src/extractors/chat-discovery.ts
import { realpathSync as realpathSync2 } from "node:fs";
import { readdir as readdir6, readFile as readFile12, stat as stat4 } from "node:fs/promises";
import { basename as basename3, join as join13, resolve } from "node:path";
function normalizeProjectCwd(cwd) {
  if (!cwd)
    return null;
  const resolved = resolve(cwd);
  try {
    return realpathSync2(resolved);
  } catch {
    return resolved;
  }
}
async function readJson(path) {
  return JSON.parse(await readFile12(path, "utf-8"));
}
function isFreebuffChat(runState) {
  const agentType = runState?.sessionState?.mainAgentState?.agentType;
  return typeof agentType === "string" && /-free(-|$)/.test(agentType);
}
function projectRootOf(runState) {
  const root = runState?.sessionState?.fileContext?.projectRoot;
  return typeof root === "string" && root.length > 0 ? root : null;
}
async function discoverChats(cwd, options) {
  const result = { chats: [], notOurs: [] };
  const project = normalizeProjectCwd(cwd);
  if (!project)
    return result;
  const chatsDir = join13(getFreebuffProjectsDir(), basename3(project), "chats");
  let chatIds;
  try {
    chatIds = await readdir6(chatsDir);
  } catch {
    return result;
  }
  for (const chatId of chatIds.sort()) {
    if (result.chats.length >= options.limit)
      break;
    const chatDir = join13(chatsDir, chatId);
    let mtimeMs;
    try {
      mtimeMs = (await stat4(join13(chatDir, FREEBUFF_CHAT_MESSAGES_FILE))).mtimeMs;
    } catch {
      continue;
    }
    if (mtimeMs < options.minMtimeMs || options.skip(chatId, mtimeMs))
      continue;
    if (!options.ownChats.has(chatId)) {
      let runState;
      try {
        runState = await readJson(join13(chatDir, FREEBUFF_RUN_STATE_FILE));
      } catch {
        continue;
      }
      const root = projectRootOf(runState);
      if (!root)
        continue;
      if (normalizeProjectCwd(root) !== project || !isFreebuffChat(runState)) {
        result.notOurs.push({ chatId, mtimeMs });
        continue;
      }
    }
    try {
      const messages = await readJson(join13(chatDir, FREEBUFF_CHAT_MESSAGES_FILE));
      result.chats.push({ chatId, chatDir, projectRoot: project, messages, mtimeMs });
    } catch {
      result.notOurs.push({ chatId, mtimeMs });
    }
  }
  return result;
}
var init_chat_discovery = __esm(() => {
  init_constants();
});

// src/extractors/project-scan.ts
import { readdir as readdir7, readFile as readFile13, rename as rename3, stat as stat5, writeFile as writeFile8 } from "node:fs/promises";
import { dirname as dirname10, join as join14 } from "node:path";
async function readChatRoots() {
  try {
    return ChatRoots.parse(JSON.parse(await readFile13(CHAT_ROOTS_FILE, "utf-8")));
  } catch (error) {
    logger2.debug("Chat roots cache unreadable; rebuilding it", error);
    return {};
  }
}
async function writeChatRoots(roots) {
  await ensureDirectory(dirname10(CHAT_ROOTS_FILE));
  const tmp = `${CHAT_ROOTS_FILE}.${process.pid}.tmp`;
  await writeFile8(tmp, JSON.stringify(roots), "utf-8");
  await rename3(tmp, CHAT_ROOTS_FILE);
}
async function listDir(path) {
  try {
    return await readdir7(path);
  } catch (error) {
    logger2.debug("Freebuff directory not listable; skipping it", error);
    return [];
  }
}
async function readChatRoot(chatDir) {
  let runState;
  try {
    runState = JSON.parse(await readFile13(join14(chatDir, FREEBUFF_RUN_STATE_FILE), "utf-8"));
  } catch (error) {
    logger2.debug("Chat run-state unreadable; retrying next scan", error);
    return;
  }
  const root = projectRootOf(runState);
  if (!root)
    return;
  return isFreebuffChat(runState) ? normalizeProjectCwd(root) : null;
}
async function scanProjects(now = Date.now()) {
  const projectsDir = getFreebuffProjectsDir();
  const known = await readChatRoots();
  const seen = {};
  const newest = new Map;
  for (const dir of await listDir(projectsDir)) {
    const chatsDir = join14(projectsDir, dir, "chats");
    for (const chatId of await listDir(chatsDir)) {
      const chatDir = join14(chatsDir, chatId);
      let mtimeMs;
      try {
        mtimeMs = (await stat5(join14(chatDir, FREEBUFF_CHAT_MESSAGES_FILE))).mtimeMs;
      } catch {
        continue;
      }
      if (mtimeMs < now - STALE_SESSION_AGE_MS)
        continue;
      const key = `${dir}/${chatId}`;
      const cached = known[key];
      const root = cached && (cached.root !== null || cached.mtimeMs === mtimeMs) ? cached.root : await readChatRoot(chatDir);
      if (root === undefined)
        continue;
      seen[key] = { root, mtimeMs };
      if (root)
        newest.set(root, Math.max(newest.get(root) ?? 0, mtimeMs));
    }
  }
  if (JSON.stringify(seen) !== JSON.stringify(known))
    await writeChatRoots(seen);
  return [...newest].sort((a, b) => b[1] - a[1]).map(([root]) => root);
}
var ChatRoots;
var init_project_scan = __esm(() => {
  init_fs_utils();
  init_zod();
  init_constants();
  init_runtime();
  init_chat_discovery();
  ChatRoots = record(string2(), object({ root: string2().nullable(), mtimeMs: number2() }));
});

// ../../packages/plugin-common/src/utils/folder-exclusion.ts
import { normalize, resolve as resolve2, sep as sep3 } from "node:path";
function isCaseInsensitiveFilesystem() {
  return process.platform === "win32" || process.platform === "darwin";
}
function normalizeForComparison(path) {
  const normalized = normalize(resolve2(path));
  return isCaseInsensitiveFilesystem() ? normalized.toLowerCase() : normalized;
}
function isFolderExcluded(folderPath, settings) {
  const comparePath = normalizeForComparison(folderPath);
  const separatorForComparison = isCaseInsensitiveFilesystem() ? sep3.toLowerCase() : sep3;
  return settings.excludedFolders.some((excluded) => {
    const compareExcluded = normalizeForComparison(excluded);
    return comparePath === compareExcluded || comparePath.startsWith(compareExcluded + separatorForComparison);
  });
}
function addExcludedFolder(folderPath, settings) {
  const normalizedPath = normalize(resolve2(folderPath));
  const comparePath = normalizeForComparison(folderPath);
  const alreadyExists = settings.excludedFolders.some((f) => normalizeForComparison(f) === comparePath);
  if (alreadyExists) {
    return { settings, alreadyExcluded: true };
  }
  return {
    settings: {
      ...settings,
      excludedFolders: [...settings.excludedFolders, normalizedPath]
    },
    alreadyExcluded: false
  };
}
function removeExcludedFolder(folderPath, settings) {
  const comparePath = normalizeForComparison(folderPath);
  const matchIndex = settings.excludedFolders.findIndex((f) => normalizeForComparison(f) === comparePath);
  if (matchIndex === -1) {
    return { settings, wasExcluded: false };
  }
  return {
    settings: {
      ...settings,
      excludedFolders: settings.excludedFolders.filter((_, i) => i !== matchIndex)
    },
    wasExcluded: true
  };
}
var init_folder_exclusion = () => {};

// ../../packages/plugin-common/src/capture/open-capture.ts
async function openCapture(directory, config) {
  const { logger, privacyManager } = config;
  let settings;
  try {
    settings = await config.loadSettings();
  } catch (error) {
    return { stopped: settingsInvalid(error) };
  }
  if (isFolderExcluded(directory, settings)) {
    return {
      stopped: {
        status: "excluded",
        sessionsProcessed: 0,
        message: `${directory} is excluded from tracking`
      }
    };
  }
  const authSession = await config.identity();
  if (!authSession) {
    return {
      stopped: {
        status: "not_authenticated",
        sessionsProcessed: 0,
        message: config.notAuthenticatedMessage
      }
    };
  }
  try {
    await privacyManager.initialize({
      projectDir: directory,
      settings: settings.privacy,
      logger
    });
    if (config.reapplyPrivacySettings)
      await privacyManager.updateSettings(settings.privacy);
  } catch (error) {
    logger.error("Privacy manager failed to initialize", error);
    return {
      stopped: {
        status: "privacy_init_failed",
        sessionsProcessed: 0,
        message: "Privacy manager failed to initialize — capture skipped to avoid uploading unredacted data"
      }
    };
  }
  return { settings, authSession };
}
var init_open_capture = __esm(() => {
  init_folder_exclusion();
  init_capture_outcome();
});

// ../../packages/plugin-common/src/config/user-settings.ts
import { readFile as readFile14, rename as rename4, writeFile as writeFile9 } from "node:fs/promises";
import { dirname as dirname11 } from "node:path";
function createUserSettings(config) {
  const { file, schema, defaults, defaultsOnError } = config;
  async function loadSettingsOrDefaults(logger) {
    try {
      const content = await readFile14(file, "utf-8");
      const rawSettings = JSON.parse(content);
      const validated = schema.parse(rawSettings);
      return structuredClone({ ...defaults, ...validated });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        logger.warn("Invalid settings format, using defaults:", error.issues);
      } else if (error.code !== "ENOENT") {
        logger.warn("Failed to load settings, using defaults:", error);
      }
      return structuredClone(defaults);
    }
  }
  async function loadSettings() {
    if (defaultsOnError)
      return loadSettingsOrDefaults(defaultsOnError);
    let content;
    try {
      content = await readFile14(file, "utf-8");
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
      return structuredClone(defaults);
    }
    try {
      return structuredClone({ ...defaults, ...schema.parse(JSON.parse(content)) });
    } catch {
      throw new Error(`${file} is not valid — fix it, or delete it to start from the defaults`);
    }
  }
  async function saveSettings(settings) {
    const result = schema.safeParse(settings);
    if (!result.success) {
      throw new Error(`Invalid settings data: ${JSON.stringify(result.error?.issues)}`);
    }
    await ensureDirectory(dirname11(file));
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile9(tmp, JSON.stringify(result.data, null, 2), "utf-8");
    await rename4(tmp, file);
  }
  return { loadSettings, saveSettings };
}
var init_user_settings = __esm(() => {
  init_fs_utils();
});

// src/config/settings.ts
var UserSettingsSchema, loadSettings, saveSettings;
var init_settings = __esm(() => {
  init_user_settings();
  init_privacy_manager();
  init_zod();
  init_constants();
  UserSettingsSchema = object({
    enableRemotePersistence: boolean2().default(true),
    excludedFolders: array(string2()).default([]),
    privacy: PrivacySettingsSchema.default(DEFAULT_PRIVACY_SETTINGS)
  });
  ({ loadSettings, saveSettings } = createUserSettings({
    file: SETTINGS_FILE,
    schema: UserSettingsSchema,
    defaults: {
      enableRemotePersistence: true,
      excludedFolders: [],
      privacy: DEFAULT_PRIVACY_SETTINGS
    }
  }));
});

// src/extractors/chat-parser.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
function chatIdToIso(chatId) {
  const match = chatId.match(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2}(?:\.\d+)?Z)$/);
  if (!match)
    return null;
  const date = new Date(`${match[1]}:${match[2]}:${match[3]}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function idToIso(id) {
  const ms = Number(id.match(ID_MS)?.[1]);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}
function blockText(block) {
  switch (block.type) {
    case "text":
      if (block.textType === "reasoning")
        return null;
      return typeof block.content === "string" ? block.content : null;
    case "tool":
      return typeof block.toolName === "string" ? `[tool: ${block.toolName}]` : null;
    case "agent": {
      const name = typeof block.agentType === "string" ? block.agentType : block.agentName;
      return typeof name === "string" ? `[agent: ${name}]` : "[agent]";
    }
    case "plan":
      return typeof block.content === "string" ? block.content : null;
    case "image":
      return `[image: ${typeof block.filename === "string" ? block.filename : "attachment"}]`;
    default:
      return null;
  }
}
function assistantContent(message) {
  if (!Array.isArray(message.blocks)) {
    return typeof message.content === "string" ? message.content : "";
  }
  const pieces = [];
  for (const block of message.blocks) {
    if (!isRecord2(block))
      continue;
    const text = blockText(block);
    if (text)
      pieces.push(text);
  }
  return pieces.join("").trim();
}
function attachmentNames(list, key) {
  if (!Array.isArray(list))
    return [];
  return list.map((item) => isRecord2(item) && typeof item[key] === "string" ? item[key] : null).filter((name) => name !== null);
}
function userContent(message) {
  const pieces = [typeof message.content === "string" ? message.content : ""];
  for (const name of attachmentNames(message.attachments, "filename"))
    pieces.push(`[image: ${name}]`);
  for (const name of attachmentNames(message.fileAttachments, "filename"))
    pieces.push(`[file: ${name}]`);
  if (attachmentNames(message.textAttachments, "preview").length > 0)
    pieces.push("[pasted text]");
  return pieces.filter(Boolean).join(`
`).trim();
}
function isFinished(message) {
  const runState = isRecord2(message.metadata) ? message.metadata.runState : undefined;
  return runState != null || typeof message.completionTime === "string";
}
function parseChat(input) {
  if (!Array.isArray(input.messages))
    return null;
  const createdAt = chatIdToIso(input.chatId);
  if (!createdAt)
    return null;
  const messages = [];
  let inProgress = false;
  let lastAt = createdAt;
  for (const raw of input.messages) {
    if (!isRecord2(raw))
      continue;
    const message = raw;
    if (typeof message.id !== "string")
      continue;
    const at = idToIso(message.id) ?? lastAt;
    lastAt = at;
    if (message.variant === "user") {
      const content = userContent(message);
      if (content)
        messages.push({ sourceId: message.id, role: "user", content, createdAt: at });
      continue;
    }
    if (message.variant !== "ai" || !message.id.startsWith("ai-"))
      continue;
    const content = assistantContent(message);
    if (isFinished(message)) {
      if (content)
        messages.push({ sourceId: message.id, role: "assistant", content, createdAt: at });
      continue;
    }
    if (message.isComplete === true || input.abandoned) {
      if (content) {
        messages.push({
          sourceId: message.id,
          role: "assistant",
          content,
          createdAt: at,
          turnIncomplete: true
        });
      }
      continue;
    }
    inProgress = true;
    break;
  }
  const firstUser = messages.find((m) => m.role === "user")?.content.split(`
`)[0]?.trim();
  return {
    chatId: input.chatId,
    projectRoot: input.projectRoot,
    title: firstUser || input.chatId,
    createdAt,
    messages,
    inProgress
  };
}
var ID_MS;
var init_chat_parser = __esm(() => {
  ID_MS = /^(?:user|ai)-(\d{12,})/;
});

// src/pipeline.ts
import { createHash as createHash2 } from "node:crypto";
import { readFile as readFile15, rename as rename5, writeFile as writeFile10 } from "node:fs/promises";
import { basename as basename4, join as join15 } from "node:path";
function projectStateFile(cwd) {
  return join15(STATE_DIR, `${v5_default(cwd, ZEST_SESSION_NAMESPACE)}.json`);
}
function isPlainObject3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function readProjectState(cwd) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile15(projectStateFile(cwd), "utf-8"));
  } catch (error) {
    logger2.debug("Project state unreadable; starting without it", error);
    return null;
  }
  const field = (name) => isPlainObject3(parsed) && isPlainObject3(parsed[name]) ? parsed[name] : {};
  const state = { chats: {}, skipped: {} };
  for (const [id, cursor] of Object.entries(field("chats"))) {
    if (isPlainObject3(cursor) && Array.isArray(cursor.emittedIds)) {
      state.chats[id] = cursor;
    }
  }
  for (const [id, mtimeMs] of Object.entries(field("skipped"))) {
    if (typeof mtimeMs === "number")
      state.skipped[id] = mtimeMs;
  }
  return state;
}
async function writeProjectState(cwd, state) {
  await ensureDirectory(STATE_DIR);
  const file = projectStateFile(cwd);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile10(tmp, JSON.stringify(state), "utf-8");
  await rename5(tmp, file);
}
async function hasCaptureRun(cwd) {
  const project = normalizeProjectCwd(cwd);
  return project ? await readProjectState(project) !== null : false;
}
async function skipChats(cwd, chats) {
  const project = normalizeProjectCwd(cwd);
  if (!project || chats.length === 0)
    return;
  await withFileLock(projectStateFile(project), async () => {
    const state = await readProjectState(project) ?? { chats: {}, skipped: {} };
    for (const { chatId, mtimeMs } of chats) {
      if (!state.chats[chatId])
        state.skipped[chatId] = mtimeMs;
    }
    await writeProjectState(project, state);
  });
}
function sessionTitle(firstLine) {
  return privacyManager.redactMessage(firstLine).slice(0, 120);
}
function sessionIdFor(projectRoot, chatId) {
  return v5_default(`${projectRoot}\x00${chatId}`, ZEST_SESSION_NAMESPACE);
}
async function captureCwd(cwd, now = Date.now(), maxChats = Number.POSITIVE_INFINITY, hostsClosed = false) {
  const project = normalizeProjectCwd(cwd);
  if (!project) {
    return { status: "no_sessions", sessionsProcessed: 0, message: "No project directory" };
  }
  const opened = await openCapture(project, {
    logger: logger2,
    loadSettings,
    identity: () => zest.auth.identity(),
    privacyManager,
    notAuthenticatedMessage: NOT_AUTHENTICATED_MESSAGE
  });
  if (opened.stopped)
    return opened.stopped;
  const { authSession } = opened;
  return withFileLock(projectStateFile(project), () => captureLocked(project, authSession, now, maxChats, hostsClosed));
}
function digest(content) {
  return createHash2("sha1").update(content).digest("hex").slice(0, 16);
}
async function dropQueuedMessage(sessionId, messageIndex) {
  await atomicUpdateQueue(MESSAGES_QUEUE_FILE, (items) => items.filter((item) => !(item.session_id === sessionId && item.message_index === messageIndex)));
}
async function captureLocked(project, authSession, now, maxChats, hostsClosed) {
  const state = await readProjectState(project) ?? { chats: {}, skipped: {} };
  const staleBefore = now - STALE_SESSION_AGE_MS;
  for (const [chatId, cursor] of Object.entries(state.chats)) {
    if (cursor.mtimeMs < staleBefore)
      delete state.chats[chatId];
  }
  for (const [chatId, mtimeMs] of Object.entries(state.skipped)) {
    if (mtimeMs < staleBefore)
      delete state.skipped[chatId];
  }
  const { chats, notOurs } = await discoverChats(project, {
    ownChats: new Set(Object.keys(state.chats)),
    minMtimeMs: staleBefore,
    limit: maxChats,
    skip: (chatId, mtimeMs) => {
      if (state.skipped[chatId] === mtimeMs)
        return true;
      const cursor = state.chats[chatId];
      if (!cursor)
        return false;
      if (!cursor.pending)
        return cursor.mtimeMs === mtimeMs;
      if (hostsClosed)
        return false;
      if (now - mtimeMs < SETTLE_MS)
        return true;
      return cursor.mtimeMs === mtimeMs && now - mtimeMs <= ABANDONED_TURN_AGE_MS;
    }
  });
  for (const { chatId, mtimeMs } of notOurs)
    state.skipped[chatId] = mtimeMs;
  if (chats.length === 0) {
    await writeProjectState(project, state);
    return { status: "no_sessions", sessionsProcessed: 0, message: "No new or changed chats" };
  }
  await initializeQueue();
  let processed = 0;
  let failed = 0;
  for (const chat of chats) {
    try {
      const cursor = state.chats[chat.chatId] ?? { mtimeMs: 0, emittedIds: [] };
      const parsed = parseChat({
        chatId: chat.chatId,
        projectRoot: chat.projectRoot,
        messages: chat.messages,
        abandoned: hostsClosed || now - chat.mtimeMs > ABANDONED_TURN_AGE_MS
      });
      if (!parsed) {
        failed++;
        state.skipped[chat.chatId] = chat.mtimeMs;
        continue;
      }
      const sent = new Set(cursor.emittedIds);
      const provisional = { ...cursor.provisional };
      const fresh = parsed.messages.filter((message) => !sent.has(message.sourceId));
      const revised = parsed.messages.filter((message) => {
        const sentAs = provisional[message.sourceId];
        return sentAs !== undefined && (!message.turnIncomplete || digest(message.content) !== sentAs);
      });
      const sessionId = sessionIdFor(parsed.projectRoot, parsed.chatId);
      if (fresh.length > 0 || revised.length > 0) {
        await enqueueChatSession({
          id: sessionId,
          title: sessionTitle(parsed.title),
          created_at: parsed.createdAt,
          project_id: v5_default(parsed.projectRoot, ZEST_SESSION_NAMESPACE),
          project_name: basename4(parsed.projectRoot) || parsed.projectRoot,
          user_id: authSession.userId,
          workspace_id: authSession.workspaceId ?? null,
          metadata: {}
        });
        const toSend = [
          ...revised.map((message) => ({
            message,
            index: cursor.emittedIds.indexOf(message.sourceId)
          })),
          ...fresh.map((message, offset) => ({
            message,
            index: cursor.emittedIds.length + offset
          }))
        ];
        for (const { message, index } of toSend) {
          const version = digest(message.content);
          if (revised.includes(message))
            await dropQueuedMessage(sessionId, index);
          await enqueueChatMessage({
            id: v5_default(`${sessionId}:${message.sourceId}:${version}`, ZEST_SESSION_NAMESPACE),
            session_id: sessionId,
            message_index: index,
            role: message.role,
            content: message.content,
            created_at: message.createdAt,
            user_id: authSession.userId,
            metadata: message.turnIncomplete ? { turn_incomplete: true } : {}
          });
          if (message.turnIncomplete)
            provisional[message.sourceId] = version;
          else
            delete provisional[message.sourceId];
        }
        processed++;
      }
      state.chats[chat.chatId] = {
        mtimeMs: chat.mtimeMs,
        pending: parsed.inProgress,
        emittedIds: [...cursor.emittedIds, ...fresh.map((message) => message.sourceId)],
        ...Object.keys(provisional).length > 0 ? { provisional } : {}
      };
    } catch (error) {
      failed++;
      logger2.warn(`Skipping unparseable chat ${chat.chatDir}`, error);
    }
  }
  await writeProjectState(project, state);
  if (processed === 0 && failed > 0) {
    return {
      status: "parse_error",
      sessionsProcessed: 0,
      message: "All changed chats failed to parse"
    };
  }
  if (processed === 0) {
    return { status: "no_sessions", sessionsProcessed: 0, message: "No new messages" };
  }
  return {
    status: "ok",
    sessionsProcessed: processed,
    message: `Queued ${processed} chat(s)`
  };
}
var recordCaptureOutcome, clearUploadError, SETTLE_MS = 1e4;
var init_pipeline = __esm(() => {
  init_capture_outcome();
  init_open_capture();
  init_fs_utils();
  init_dist_node();
  init_constants();
  init_settings();
  init_chat_discovery();
  init_chat_parser();
  init_runtime();
  init_user_commands();
  ({ recordCaptureOutcome, clearUploadError } = createCaptureOutcome({
    logger: logger2,
    recordSyncMetric,
    readStatusCache,
    writeSyncStatus,
    clearSyncError
  }));
});

// src/sync.ts
async function syncQueued() {
  let locked = false;
  try {
    return await withFileLock(SYNC_LOCK_FILE, () => {
      locked = true;
      return upload.syncQueued();
    });
  } catch (error) {
    if (locked)
      throw error;
    return { status: "ok", message: "Another Freebuff process is uploading the queue" };
  }
}
var upload, getIdentityStats;
var init_sync = __esm(() => {
  init_plugin_runtime();
  init_constants();
  init_settings();
  init_pipeline();
  init_runtime();
  init_user_commands();
  upload = createPluginUpload(runtime, {
    platform: PLATFORM,
    source: SOURCE,
    sessionNamespace: ZEST_SESSION_NAMESPACE,
    loadSettings,
    clearSyncError: clearUploadError,
    loginCommand: USER_LOGIN
  });
  ({ getIdentityStats } = upload);
});

// src/commands/watch-cli.ts
var exports_watch_cli = {};
__export(exports_watch_cli, {
  claimWatcher: () => claimWatcher,
  liveHosts: () => liveHosts2,
  main: () => main,
  registerHost: () => registerHost2,
  runningWatcher: () => runningWatcher,
  tick: () => tick
});
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir as mkdir6, readFile as readFile16, rm as rm3, stat as stat6, utimes, writeFile as writeFile11 } from "node:fs/promises";
async function reportFailure(error) {
  logger2.error("Freebuff capture failed", error);
  try {
    await captureException(error instanceof Error ? error : new Error(String(error)), "extraction_session_failed", "freebuff-plugin");
  } catch (error) {
    logger2.debug("Could not report the capture failure to analytics", error);
  }
}
async function tick({ hostsClosed = false } = {}) {
  try {
    loadRuntimeEnvIntoProcess();
    for (const project of await scanProjects()) {
      try {
        const result = await captureCwd(project, Date.now(), hostsClosed ? Number.POSITIVE_INFINITY : MAX_CHATS_PER_TICK, hostsClosed);
        await recordCaptureOutcome(result);
        if (capturePausesSync(result.status))
          return;
      } catch (error) {
        await reportFailure(error);
      }
    }
    await syncQueued();
  } catch (error) {
    await reportFailure(error);
  }
}
async function readPid(pidFile) {
  try {
    const pid = Number.parseInt(await readFile16(pidFile, "utf-8"), 10);
    return pid > 0 ? pid : null;
  } catch (error) {
    logger2.debug("Watcher pid file unreadable; treating the watcher as stopped", error);
    return null;
  }
}
async function runningWatcher(pidFile = WATCHER_PID_FILE, now = Date.now()) {
  try {
    if (now - (await stat6(pidFile)).mtimeMs > WATCHER_STALE_MS)
      return null;
  } catch (error) {
    logger2.debug("Watcher pid file missing; treating the watcher as stopped", error);
    return null;
  }
  const pid = await readPid(pidFile);
  return pid !== null && isAlive(pid) ? pid : null;
}
async function claimWatcher(pidFile = WATCHER_PID_FILE) {
  for (let attempt = 0;attempt < 3; attempt++) {
    try {
      await writeFile11(pidFile, String(process.pid), { encoding: "utf-8", flag: "wx" });
      return null;
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
    }
    const other = await runningWatcher(pidFile);
    if (other !== null)
      return other;
    await rm3(pidFile, { force: true });
  }
  return await readPid(pidFile) ?? -1;
}
async function startBesideHost(pid) {
  if (!(pid > 0)) {
    console.error("❌ watch --host needs the pid of a running Freebuff");
    process.exit(1);
    return;
  }
  await registerHost2(pid);
  if (await runningWatcher() !== null)
    return;
  await mkdir6(LOGS_DIR, { recursive: true });
  const log = openSync(WATCH_LOG_FILE, "a");
  spawn(process.execPath, [process.argv[1], "watch", "--hosted"], {
    detached: true,
    stdio: ["ignore", log, log]
  }).unref();
}
async function main(args) {
  await ensureDirectory(FREEBUFF_ZEST_DIR);
  const host = args.indexOf("--host");
  if (host !== -1)
    return startBesideHost(Number(args[host + 1]));
  const hosted = args.includes("--hosted");
  const other = await claimWatcher();
  if (other !== null) {
    console.error(`❌ Already watching Freebuff chats (pid ${other}, ${WATCHER_PID_FILE})`);
    process.exit(0);
    return;
  }
  console.log(hosted ? `\uD83D\uDC40 Watching Freebuff chats in ${getFreebuffProjectsDir()} until Freebuff exits` : `\uD83D\uDC40 Watching Freebuff chats in ${getFreebuffProjectsDir()} — Ctrl-C to stop`);
  if (!await zest.auth.identity()) {
    console.log(`⚠️  Not signed in — nothing is captured until you run ${USER_LOGIN}`);
  }
  const heartbeat = setInterval(() => {
    const at = new Date;
    utimes(WATCHER_PID_FILE, at, at).catch((error) => logger2.debug("Watcher heartbeat: could not touch the PID file", error));
  }, CAPTURE_INTERVAL_MS);
  let stopping = false;
  let timer;
  let current = Promise.resolve();
  const release = async () => {
    if (await readPid(WATCHER_PID_FILE) === process.pid)
      await rm3(WATCHER_PID_FILE, { force: true });
  };
  const lastHostGone = async () => {
    if ((await liveHosts2()).length > 0)
      return false;
    await tick({ hostsClosed: true });
    await release();
    return (await liveHosts2()).length === 0 || await claimWatcher() !== null;
  };
  const exit = (code) => {
    clearInterval(heartbeat);
    clearTimeout(timer);
    process.exit(code);
  };
  const loop = () => {
    current = tick().then(() => hosted && !stopping && lastHostGone()).catch((error) => {
      logger2.debug("Watcher host check failed; watching on", error);
      return false;
    }).then((done) => {
      if (done)
        exit(0);
      else if (!stopping)
        timer = setTimeout(loop, CAPTURE_INTERVAL_MS);
    });
  };
  const stop = async () => {
    if (stopping)
      process.exit(1);
    stopping = true;
    clearInterval(heartbeat);
    clearTimeout(timer);
    await current;
    await release();
    exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  loop();
}
var registerHost2 = (pid, dir = HOSTS_DIR) => registerHost(dir, pid), liveHosts2 = (dir = HOSTS_DIR) => liveHosts(dir);
var init_watch_cli = __esm(() => {
  init_capture_outcome();
  init_hosts();
  init_fs_utils();
  init_constants();
  init_project_scan();
  init_pipeline();
  init_runtime();
  init_user_commands();
  init_sync();
});

// src/commands/install-cli.ts
var exports_install_cli = {};
__export(exports_install_cli, {
  LOADER_MARKER: () => LOADER_MARKER,
  defaultLoginService: () => defaultLoginService,
  findBundledCli: () => findBundledCli,
  install: () => install,
  main: () => main2,
  removeLegacyLoader: () => removeLegacyLoader,
  uninstall: () => uninstall,
  uninstallMain: () => uninstallMain
});
import { existsSync as existsSync3 } from "node:fs";
import { chmod as chmod4, copyFile, mkdir as mkdir7, readFile as readFile17, rename as rename6, rm as rm4, writeFile as writeFile12 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname12, join as join16, resolve as resolve3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
async function removeLegacyLoader(loaderFile = AGENT_LOADER_FILE, pluginFile = LEGACY_PLUGIN_FILE) {
  let removed = false;
  try {
    if ((await readFile17(loaderFile, "utf-8")).includes(LOADER_MARKER)) {
      await rm4(loaderFile, { force: true });
      removed = true;
    }
  } catch (error) {
    logger2.debug("Legacy loader not readable; nothing to remove", error);
  }
  await rm4(pluginFile, { force: true });
  return removed;
}
function findBundledCli(here = dirname12(fileURLToPath2(import.meta.url))) {
  const candidates = [join16(here, "cli.js"), join16(here, "..", "..", "lib", "cli.js")];
  return candidates.find((path) => existsSync3(path)) ?? null;
}
function defaultLoginService(exec = run) {
  return loginServiceFor2({ platform: process.platform, home: homedir2(), uid: process.getuid?.() ?? -1 }, exec);
}
async function install(bundle, { cliFile, shimFile, rcFiles, service, exec, node = process.execPath, retryMs }) {
  if (!bundle)
    throw new Error("CLI bundle not found — run `bun run build` first");
  await mkdir7(dirname12(cliFile), { recursive: true, mode: 448 });
  if (resolve3(bundle) !== resolve3(cliFile)) {
    const tmp = `${cliFile}.${process.pid}.tmp`;
    await copyFile(bundle, tmp);
    await rename6(tmp, cliFile);
  }
  const manual = await removeLoginService(service, exec, retryMs);
  if (shimFile) {
    await mkdir7(dirname12(shimFile), { recursive: true });
    await writeFile12(shimFile, shimScript2(node, cliFile), "utf-8");
    await chmod4(shimFile, 493);
    for (const file of rcFiles)
      await addPathBlock(file, dirname12(shimFile));
  }
  return manual;
}
async function uninstall({
  cliFile,
  shimFile,
  rcFiles,
  service,
  exec,
  retryMs
}) {
  for (const file of rcFiles)
    await removePathBlock(file);
  if (shimFile)
    await rm4(dirname12(shimFile), { recursive: true, force: true });
  await rm4(dirname12(cliFile), { recursive: true, force: true });
  return removeLoginService(service, exec, retryMs);
}
function defaultTarget() {
  return {
    cliFile: INSTALLED_CLI_FILE,
    shimFile: process.platform === "win32" ? null : SHIM_FILE,
    rcFiles: rcFilesFor(homedir2(), process.env.SHELL, process.platform, process.env.ZDOTDIR),
    service: defaultLoginService(),
    exec: run
  };
}
function manualServiceMessage(manual) {
  return `The login service of an earlier install could not be stopped from here — run \`${manual}\` in your desktop session, then run this again.`;
}
async function main2(_args) {
  try {
    if (await removeLegacyLoader()) {
      console.log(`\uD83E\uDDF9 Removed the old in-process loader ${AGENT_LOADER_FILE}.`);
    }
    const target = defaultTarget();
    const hadService = target.service !== null && existsSync3(target.service.file);
    const manual = await install(findBundledCli(), target);
    if (!target.shimFile) {
      console.log(`✅ Installed. On Windows nothing starts capture for you — keep ${USER_WATCH} running while you use Freebuff.`);
    } else {
      console.log("✅ Installed. Capture starts with `freebuff` and stops after the last one exits.");
      if (process.env.SHELL?.endsWith("/fish")) {
        console.log("   fish reads none of the files install edits — run this once, then open a new terminal:");
        console.log(`   fish_add_path --prepend '${SHIM_DIR}'`);
      } else if (target.rcFiles.length > 0) {
        console.log(`   Added ${SHIM_DIR} to PATH in ${target.rcFiles.join(", ")}.`);
        console.log("   Open a new terminal before you start freebuff.");
      } else {
        console.log(`   Add this to your shell's startup file, then open a new terminal:`);
        console.log(`   ${pathBlock(SHIM_DIR).split(`
`)[1]}`);
      }
      console.log(`   Log: ${WATCH_LOG_FILE}`);
      console.log(`   Runs with ${process.execPath} — run install again after upgrading or switching Node.`);
    }
    if (manual)
      console.log(`⚠️  ${manualServiceMessage(manual)}`);
    else if (hadService)
      console.log("   Removed the background service an earlier install added.");
    if (!await zest.auth.identity())
      console.log(`Next: sign in with ${USER_LOGIN}`);
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
async function uninstallMain(_args) {
  try {
    if (await removeLegacyLoader()) {
      console.log(`\uD83E\uDDF9 Removed the old in-process loader ${AGENT_LOADER_FILE}.`);
    }
    const manual = await uninstall({
      ...defaultTarget(),
      rcFiles: allRcFiles(homedir2(), process.env.ZDOTDIR)
    });
    if (manual) {
      console.error(`❌ ${manualServiceMessage(manual)}`);
      process.exit(1);
      return;
    }
    if (await runningWatcher() !== null) {
      await stopProcessFromPidFile(WATCHER_PID_FILE, { timeoutMs: 1e4 });
    }
    console.log("✅ Uninstalled — `freebuff` no longer starts capture.");
    console.log("   In a bash terminal that is still open, run `hash -r` if freebuff is not found.");
    console.log(`Your Zest sign-in and unsent queue stay in ${FREEBUFF_ZEST_DIR}; delete that folder to remove them.`);
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
var LOADER_MARKER = "zest-freebuff loader", LEGACY_PLUGIN_FILE;
var init_install_cli = __esm(() => {
  init_dev();
  init_constants();
  init_runtime();
  init_login_service2();
  init_shell_shim();
  init_user_commands();
  init_watch_cli();
  LEGACY_PLUGIN_FILE = join16(FREEBUFF_ZEST_DIR, "lib", "plugin.js");
});

// ../../packages/plugin-common/src/commands/login.ts
async function ensureSignedIn(zest) {
  const existing = await zest.auth.get();
  if (existing) {
    return { ...existing, isNew: false };
  }
  const auth = await zest.auth.login();
  return { ...auth, isNew: true };
}
function createLoginCommand(config) {
  const { logger, zest } = config;
  return async (_args = []) => {
    try {
      const signedIn = await ensureSignedIn(zest);
      console.log(signedIn.isNew ? `✅ Authenticated: ${signedIn.email}` : `Already authenticated: ${signedIn.email}`);
      if (signedIn.workspaceName)
        console.log(`\uD83C\uDFE2 Workspace: ${signedIn.workspaceName}`);
      if (config.afterLogin) {
        await config.afterLogin(signedIn).catch((error) => {
          logger.warn("Post-login step failed", error);
        });
      }
      console.log(`\uD83D\uDCC8 Your sessions will show up at: ${zest.webUrl("/app")}`);
      if (config.closingLine)
        console.log(config.closingLine);
    } catch (error) {
      logger.error("Authentication failed", error);
      console.error(`❌ Auth failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  };
}
function createLogoutCommand(config) {
  const { logger, zest } = config;
  return async (_args = []) => {
    try {
      const ended = await zest.auth.logout();
      await config.afterLogout?.();
      console.log("✅ Logged out");
      if (!ended)
        console.log(SERVER_SESSION_NOT_ENDED);
    } catch (error) {
      logger.error("Logout failed", error);
      console.error(`❌ Logout failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  };
}
var SERVER_SESSION_NOT_ENDED = "Signed out on this machine, but Zest could not confirm the session ended on the server (offline, or it had already expired). The local credentials are deleted.";

// ../../packages/plugin-common/src/sync/initial-sync.ts
import { existsSync as existsSync4 } from "node:fs";
import { mkdir as mkdir8, writeFile as writeFile13 } from "node:fs/promises";
import { dirname as dirname13 } from "node:path";
function startOfLocalDay(now = new Date) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}
async function hasSyncedSessions(zest) {
  const config = await zest.config({ force: true });
  if (!config)
    throw new Error("Could not read plugin config");
  return config.has_sessions;
}
async function runInitialSyncOnce(opts) {
  if (existsSync4(opts.markerFile))
    return { outcome: "already_done", sessions: 0 };
  let result;
  if (await opts.hasSyncedSessions()) {
    result = { outcome: "already_synced", sessions: 0 };
  } else {
    const sessions = await opts.syncToday(startOfLocalDay(opts.now));
    result = { outcome: "synced", sessions };
  }
  await mkdir8(dirname13(opts.markerFile), { recursive: true });
  await writeFile13(opts.markerFile, JSON.stringify({ ...result, ranAt: new Date().toISOString() }), "utf-8");
  return result;
}
var init_initial_sync = () => {};

// src/utils/initial-sync.ts
import { join as join17 } from "node:path";
function syncTodayOnFirstLogin() {
  return runInitialSyncOnce({
    markerFile: join17(FREEBUFF_ZEST_DIR, "initial-sync.json"),
    hasSyncedSessions: () => hasSyncedSessions(zest),
    syncToday: queueChatsSince
  });
}
async function queueChatsSince(since) {
  const now = Date.now();
  const settings = await loadSettings();
  await scanProjects(now);
  const chats = Object.entries(await readChatRoots()).flatMap(([key, { root, mtimeMs }]) => root ? [{ root, chatId: key.slice(key.lastIndexOf("/") + 1), mtimeMs }] : []);
  const picked = new Set(chats.filter((chat) => chat.mtimeMs >= since.getTime() && !isFolderExcluded(chat.root, settings)).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_INITIAL_SESSIONS));
  let queued = 0;
  for (const root of new Set(chats.map((chat) => chat.root))) {
    const inRoot = chats.filter((chat) => chat.root === root);
    try {
      await skipChats(root, inRoot.filter((chat) => !picked.has(chat)));
      if (inRoot.some((chat) => picked.has(chat))) {
        queued += (await captureCwd(root, now)).sessionsProcessed;
      }
    } catch (error) {
      logger2.warn(`Initial sync skipped ${root}`, error);
    }
  }
  return queued;
}
var MAX_INITIAL_SESSIONS = 10;
var init_initial_sync2 = __esm(() => {
  init_initial_sync();
  init_folder_exclusion();
  init_constants();
  init_settings();
  init_project_scan();
  init_pipeline();
  init_runtime();
});

// src/commands/login-cli.ts
var exports_login_cli = {};
__export(exports_login_cli, {
  main: () => main3
});
import { existsSync as existsSync5 } from "node:fs";
async function main3(args) {
  loadRuntimeEnvIntoProcess();
  await login(args);
  console.log(await runningWatcher() !== null || existsSync5(SHIM_FILE) ? "Use freebuff as usual — Zest picks up new chats within about 15 s." : `Capture is not set up yet — run ${USER_INSTALL}.`);
}
var login;
var init_login_cli = __esm(() => {
  init_constants();
  init_runtime();
  init_user_commands();
  init_sync();
  init_initial_sync2();
  init_watch_cli();
  login = createLoginCommand({
    logger: logger2,
    zest,
    afterLogin: async ({ isNew }) => {
      await snapshotRuntimeEnv();
      await clearSyncError();
      if (!isNew)
        return;
      const initial = await syncTodayOnFirstLogin().catch((error) => {
        logger2.warn("Initial sync of today's chats failed", error);
        return null;
      });
      if (initial?.sessions) {
        await syncQueued().catch((error) => logger2.error("Queue drain failed", error));
        console.log(`\uD83D\uDCE5 Imported ${initial.sessions} chat(s) from today — manage them on the My data page at ${zest.webUrl("/app")}`);
      }
    }
  });
});

// src/commands/logout-cli.ts
var exports_logout_cli = {};
__export(exports_logout_cli, {
  main: () => main4
});
var main4;
var init_logout_cli = __esm(() => {
  init_runtime();
  main4 = createLogoutCommand({ logger: logger2, zest });
});

// ../../packages/plugin-common/src/commands/status.ts
function formatRelativeTime(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  if (diffSec < 5)
    return "just now";
  if (diffSec < 60)
    return `${diffSec} sec ago`;
  if (diffMin < 60)
    return `${diffMin} min ago`;
  return `${diffHr} hr ago`;
}
function isPreLoginTick(metric, signedIn, lastSuccessAt) {
  if (metric.success || !signedIn)
    return false;
  if (metric.errorType === "not_authenticated")
    return true;
  return lastSuccessAt != null && metric.timestamp < lastSuccessAt;
}
function splitHourErrors(metrics, signedIn, lastSuccessAt) {
  let live = 0;
  let preLogin = 0;
  for (const m of metrics) {
    if (m.success)
      continue;
    if (isPreLoginTick(m, signedIn, lastSuccessAt)) {
      preLogin += 1;
    } else {
      live += 1;
    }
  }
  return { live, preLogin };
}
function shouldShowLiveSyncError(opts) {
  if (opts.liveHourErrors > 0)
    return true;
  if (opts.lastSuccessAt != null && opts.lastErrorAt != null && opts.lastSuccessAt > opts.lastErrorAt) {
    return false;
  }
  return opts.hasError;
}
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (error) {
    logHandled("backend URL is not a URL; skipping the backend comparison", error);
    return null;
  }
}
function backendMismatchLine(snapshotUrl, processUrl) {
  const snapshotHost = hostOf(snapshotUrl);
  const processHost = hostOf(processUrl);
  if (!snapshotHost || !processHost || snapshotHost === processHost)
    return null;
  return "This command is using a different Zest backend than the background process.";
}
function formatFutureTime(timestamp) {
  const diffMs = timestamp - Date.now();
  if (diffMs <= 0)
    return "now";
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  if (diffSec < 60)
    return `in ${diffSec} sec`;
  return `in ${diffMin} min`;
}
function createStatusCommand(config) {
  const {
    logger,
    zest,
    loadSettings,
    getDetailedQueueStats,
    aggregateLastHourStats,
    getLastHourMetrics,
    readStatusCache,
    writeSyncStatus,
    acknowledgeLegacyQueueDrop,
    getIdentityStats,
    host
  } = config;
  return async (_args = []) => {
    try {
      const currentFolder = await host.currentFolder();
      const authState = await zest.auth.state();
      const session = await zest.auth.identity();
      const settings = await loadSettings();
      const queueStats = await getDetailedQueueStats();
      const lastHourStats = await aggregateLastHourStats();
      let statusCache = readStatusCache();
      if (session && statusCache.syncStatus.errorType === "not_authenticated") {
        await writeSyncStatus({
          hasError: false,
          errorType: null,
          errorMessage: null,
          lastErrorAt: statusCache.syncStatus.lastErrorAt,
          lastSuccessAt: statusCache.syncStatus.lastSuccessAt
        });
        statusCache = readStatusCache();
      }
      const pluginConfig = session ? await zest.config() : null;
      const freshWorkspaceName = pluginConfig?.workspace?.name;
      if (authState.status === "signed_in" || authState.status === "agent") {
        console.log(`✅ Authenticated: ${session?.email || session?.userId || "agent"}`);
      } else if (authState.status === "pending_exchange") {
        console.log(`✅ Authenticated: ${session?.email ?? ""} (moving your login to Zest 2…)`);
      } else if (authState.status === "awaiting_migration") {
        console.log(`⏳ Signed in as ${session?.email ?? "you"}; your account is still being moved to Zest 2. Sessions stay queued until then.`);
      } else {
        console.log(`❌ Not authenticated — run ${config.loginCommand}`);
      }
      if (session?.workspaceId) {
        const displayName = freshWorkspaceName ?? session.workspaceName;
        if (displayName) {
          console.log(`\uD83C\uDFE2 Workspace: ${displayName}`);
        } else {
          console.log("⚠️  No workspace selected");
        }
      } else if (session) {
        console.log("⚠️  No workspace selected");
      }
      console.log("");
      const { synced, lastSyncAt } = lastHourStats;
      const syncedTotal = synced.sessions + synced.messages;
      if (syncedTotal > 0) {
        const lastSyncStr = lastSyncAt ? ` (last: ${formatRelativeTime(lastSyncAt)})` : "";
        console.log(`✅ Synced (last hour): ${synced.sessions} session(s), ${synced.messages} message(s)${lastSyncStr}`);
      } else {
        console.log("\uD83D\uDCCA Synced (last hour): No data synced yet");
      }
      const { sessions: sessionStats, messages: messageStats } = queueStats;
      const totalPending = sessionStats.total + messageStats.total;
      if (totalPending > 0) {
        let nextSyncStr = "";
        if (settings.enableRemotePersistence && lastSyncAt) {
          nextSyncStr = ` (next: ${formatFutureTime(lastSyncAt + config.syncIntervalMs)})`;
        } else if (settings.enableRemotePersistence) {
          nextSyncStr = " (next: on the next turn)";
        }
        console.log(`⏳ Pending: ${sessionStats.total} session(s), ${messageStats.total} message(s)${nextSyncStr}`);
        if (sessionStats.waitingForMessages > 0) {
          console.log(`   ℹ️   ${sessionStats.waitingForMessages} session(s) waiting for more messages`);
        }
      } else {
        console.log("✅ Pending: All synced");
      }
      if (session) {
        const identityStats = await getIdentityStats(session.userId);
        if (identityStats.mismatchedSessions > 0 || identityStats.mismatchedMessages > 0) {
          console.log(`   ℹ️   ${identityStats.mismatchedSessions} session(s), ${identityStats.mismatchedMessages} message(s) queued under a different account — sign in as that account to sync them`);
        }
      }
      const hourMetrics = await getLastHourMetrics();
      const { live: liveHourErrors, preLogin: preLoginTicks } = splitHourErrors(hourMetrics, Boolean(session), statusCache.syncStatus.lastSuccessAt);
      const showLiveError = shouldShowLiveSyncError({
        hasError: statusCache.syncStatus.hasError,
        lastSuccessAt: statusCache.syncStatus.lastSuccessAt,
        lastErrorAt: statusCache.syncStatus.lastErrorAt,
        liveHourErrors
      });
      if (showLiveError || preLoginTicks > 0) {
        console.log("");
        if (showLiveError) {
          const cacheMessage = statusCache.syncStatus.errorMessage;
          if (statusCache.syncStatus.hasError && cacheMessage) {
            console.log(`❌ Sync error: ${cacheMessage}`);
          } else if (liveHourErrors > 0) {
            console.log(`⚠️  ${liveHourErrors} sync error(s) in the last hour`);
          }
          const liveConnectFailure = hourMetrics.some((m) => !m.success && m.errorType === "network_error" && !isPreLoginTick(m, Boolean(session), statusCache.syncStatus.lastSuccessAt));
          if (session && (statusCache.syncStatus.errorType === "network_error" || liveConnectFailure)) {
            console.log(`   ${config.syncNextAction()}`);
          }
        }
        if (preLoginTicks > 0) {
          console.log(`   ℹ️   ${preLoginTicks} tick(s) before login (not current errors)`);
        }
      }
      console.log(typeof host.captureLine === "string" ? host.captureLine : await host.captureLine());
      if (statusCache.devMode?.active) {
        console.log("\uD83D\uDD27 Dev mode: active — Ctrl+C in the terminal running `bun run dev` restores production");
      }
      if (settings.enableRemotePersistence) {
        console.log("\uD83D\uDCE4 Remote sync: Enabled");
      } else {
        console.log("\uD83D\uDCE6 Remote sync: Disabled (local only)");
      }
      console.log(`\uD83C\uDF10 Zest: ${zest.apiBase()}`);
      const mismatch = config.readSnapshotApiUrl ? backendMismatchLine(await config.readSnapshotApiUrl(), zest.apiBase()) : null;
      if (mismatch) {
        console.log(`   ℹ️   ${mismatch}`);
      }
      console.log("");
      console.log("\uD83D\uDCC1 Current folder:");
      if (currentFolder) {
        const isExcluded = isFolderExcluded(currentFolder, settings);
        console.log(`   ${currentFolder}`);
        console.log(`   Status: ${isExcluded ? "\uD83D\uDEAB Ignored" : "✅ Tracked"}`);
        for (const line of await host.folderLines?.(currentFolder, { session, isExcluded }) ?? []) {
          console.log(`   ${line}`);
        }
      } else {
        console.log(`   ${host.unknownFolderLine ?? "Unknown"}`);
      }
      const getPluginVersion = host.getPluginVersion;
      if (getPluginVersion) {
        if (statusCache.versionCheck.updateAvailable) {
          console.log("");
          console.log(`\uD83C\uDD95 Update available: ${statusCache.versionCheck.currentVersion} → ${statusCache.versionCheck.latestVersion}`);
        }
        const pinnedVersion = process.env.ZEST_PINNED_VERSION;
        if (pinnedVersion && pinnedVersion !== getPluginVersion()) {
          console.log("");
          console.log(`⏳ Running ${getPluginVersion()}, ${pinnedVersion} available — run any Zest command to finish updating`);
        }
      }
      const drop = statusCache.legacyQueueDrop;
      if (drop && !drop.acknowledged) {
        console.log("");
        console.log(`⚠️  Dropped ${drop.sessions} session(s) and ${drop.messages} message(s) queued before account identity was tracked — they had no way to be attributed correctly.`);
        await acknowledgeLegacyQueueDrop();
      }
    } catch (error) {
      logger.error("Failed to get status", error);
      console.error("❌ Failed to get status");
      if (error instanceof Error)
        console.error(`   ${error.message}`);
      process.exit(1);
    }
  };
}
var init_status = __esm(() => {
  init_folder_exclusion();
});

// src/commands/status-cli.ts
var exports_status_cli = {};
__export(exports_status_cli, {
  captureLine: () => captureLine,
  main: () => main5
});
import { existsSync as existsSync6, realpathSync as realpathSync3 } from "node:fs";
import { dirname as dirname14 } from "node:path";
async function captureLine(shimFile, pidFile = WATCHER_PID_FILE, freebuffOnPath = firstOnPath("freebuff")) {
  const pid = await runningWatcher(pidFile);
  if (pid !== null)
    return `\uD83D\uDC40 Capture: watching Freebuff chats (pid ${pid})`;
  if (shimFile === null)
    return `❌ Capture: not running — run ${USER_WATCH} and keep it running`;
  if (!existsSync6(shimFile))
    return `❌ Capture: not installed — run ${USER_INSTALL}`;
  if (freebuffOnPath !== realpathSync3(shimFile)) {
    return `⚠️  Capture: \`freebuff\` here does not start Zest — open a new terminal, or put ${dirname14(shimFile)} first on PATH`;
  }
  return "\uD83D\uDCA4 Capture: starts with your next `freebuff`";
}
var main5;
var init_status_cli = __esm(() => {
  init_status();
  init_constants();
  init_settings();
  init_pipeline();
  init_runtime();
  init_shell_shim();
  init_user_commands();
  init_sync();
  init_watch_cli();
  main5 = createStatusCommand({
    logger: logger2,
    zest,
    loadSettings,
    getDetailedQueueStats,
    aggregateLastHourStats,
    getLastHourMetrics,
    readStatusCache,
    writeSyncStatus,
    acknowledgeLegacyQueueDrop,
    getIdentityStats,
    readSnapshotApiUrl: async () => (await readRuntimeEnvSnapshot())?.ZEST_API_URL ?? "",
    syncIntervalMs: CAPTURE_INTERVAL_MS,
    loginCommand: USER_LOGIN,
    syncNextAction: userSyncNextAction,
    host: {
      currentFolder: async () => process.cwd(),
      captureLine: () => captureLine(process.platform === "win32" ? null : SHIM_FILE),
      folderLines: async (folder, { session, isExcluded }) => !isExcluded && session && !await hasCaptureRun(folder) ? ["ℹ️   Not checked yet — no Freebuff chat here in the last week"] : []
    }
  });
});

// ../../packages/plugin-common/src/commands/sync.ts
function reportCapture(capture, config) {
  if (capture.status === "not_authenticated") {
    console.log(`❌ Not authenticated — run ${config.loginCommand} first`);
    process.exit(1);
    return false;
  }
  if (capture.status === "settings_invalid") {
    console.error(`❌ ${capture.message}`);
    process.exit(1);
    return false;
  }
  if (capture.status === "excluded") {
    console.log(`\uD83D\uDCE6 ${capture.message}`);
  } else if (capture.status === "parse_error" || capture.status === "privacy_init_failed") {
    config.logger.error("Capture failed", capture.message);
    console.error(`❌ ${capture.message}`);
  } else if (capture.status === "no_sessions") {
    console.log(config.noSessionsMessage);
  } else if (capture.status === "ok") {
    console.log(`\uD83D\uDCE5 ${capture.message}`);
  }
  return true;
}
function reportSync(sync, config) {
  switch (sync.status) {
    case "ok":
      console.log(`✅ ${sync.message}`);
      return;
    case "remote_disabled":
      console.log(`\uD83D\uDCE6 ${sync.message}`);
      return;
    case "not_authenticated":
      console.log(`❌ Not authenticated — run ${config.loginCommand} first`);
      process.exit(1);
      return;
    case "settings_invalid":
      console.error(`❌ ${sync.message}`);
      process.exit(1);
      return;
    case "sync_unavailable":
      console.log(`⚠️  ${sync.message} — will retry on the next sync`);
      process.exit(1);
      return;
    case "upload_failed":
      config.logger.error("Sync failed", sync.message);
      console.error(`❌ ${sync.message}`);
      process.exit(1);
      return;
  }
  const _exhaustive = sync.status;
}
async function syncFolder(cwd, config) {
  console.log(`\uD83D\uDD04 Syncing ${cwd} ...`);
  const capture = await config.captureCwd(cwd);
  await config.recordCaptureOutcome(capture);
  if (!reportCapture(capture, config)) {
    return;
  }
  reportSync(await config.syncQueued(), config);
}

// src/commands/sync-cli.ts
var exports_sync_cli = {};
__export(exports_sync_cli, {
  main: () => main6
});
async function main6(_args) {
  loadRuntimeEnvIntoProcess();
  const cwd = process.cwd();
  await syncFolder(cwd, {
    logger: logger2,
    loginCommand: USER_LOGIN,
    noSessionsMessage: "✓ No new messages",
    captureCwd,
    recordCaptureOutcome,
    syncQueued
  });
}
var init_sync_cli = __esm(() => {
  init_pipeline();
  init_runtime();
  init_user_commands();
  init_sync();
});

// ../../packages/plugin-common/src/commands/standup.ts
function createStandupCommand(config) {
  const { logger, flushLogs, zest } = config;
  return async (_args = []) => {
    try {
      if (!await zest.auth.get()) {
        console.log(`❌ Not authenticated — run ${config.loginCommand} first`);
        return;
      }
      console.log("\uD83D\uDD04 Generating standup...");
      const result = await zest.generateStandup();
      switch (result.status) {
        case "empty":
          console.log("ℹ️  No new coding sessions found for today — nothing to analyze");
          return;
        case "already_generating":
          console.log("⏳ A standup is already being generated for today");
          console.log(result.url);
          return;
        case "generating":
          console.log("⏳ Your standup is being written and will be ready in a minute");
          console.log(result.url);
          return;
        case "ready":
          console.log("✅ Standup generated successfully!");
          console.log(result.url);
          return;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        console.log(`❌ Not authenticated — run ${config.loginCommand} first`);
        return;
      }
      logger.error("Standup generation failed with exception", error);
      console.error(`❌ Standup generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      await flushLogs();
      process.exit(1);
    }
  };
}
var init_standup = __esm(() => {
  init_client();
});

// src/commands/standup-cli.ts
var exports_standup_cli = {};
__export(exports_standup_cli, {
  main: () => main7
});
var main7;
var init_standup_cli = __esm(() => {
  init_standup();
  init_runtime();
  init_user_commands();
  main7 = createStandupCommand({
    logger: logger2,
    flushLogs: flushLogs2,
    zest,
    loginCommand: USER_LOGIN
  });
});

// ../../packages/plugin-common/src/commands/toggle-sync.ts
function createEnableSyncCommand(config) {
  return async (_args = []) => {
    try {
      const settings = await config.loadSettings();
      if (settings.enableRemotePersistence) {
        console.log("✓ Remote sync is already enabled");
        return;
      }
      settings.enableRemotePersistence = true;
      await config.saveSettings(settings);
      console.log("✅ Remote sync enabled");
      console.log("\uD83D\uDCE4 Queued data will upload on the next sync");
    } catch (error) {
      config.logger.error("Failed to enable remote sync", error);
      console.error("❌ Failed to enable: " + (error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  };
}
function createDisableSyncCommand(config) {
  return async (_args = []) => {
    try {
      const settings = await config.loadSettings();
      if (!settings.enableRemotePersistence) {
        console.log("✓ Remote sync is already disabled");
        return;
      }
      settings.enableRemotePersistence = false;
      await config.saveSettings(settings);
      console.log("✅ Remote sync disabled");
      console.log("\uD83D\uDCBE Data will queue locally only (not synced to Zest)");
      if (config.enableCommand) {
        console.log(`\uD83D\uDCA1 Use ${config.enableCommand} to re-enable syncing`);
      }
    } catch (error) {
      config.logger.error("Failed to disable remote sync", error);
      console.error("❌ Failed to disable: " + (error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  };
}

// src/commands/enable-cli.ts
var exports_enable_cli = {};
__export(exports_enable_cli, {
  main: () => main8
});
var main8;
var init_enable_cli = __esm(() => {
  init_settings();
  init_runtime();
  main8 = createEnableSyncCommand({ loadSettings, saveSettings, logger: logger2 });
});

// src/commands/disable-cli.ts
var exports_disable_cli = {};
__export(exports_disable_cli, {
  main: () => main9
});
var main9;
var init_disable_cli = __esm(() => {
  init_settings();
  init_runtime();
  init_user_commands();
  main9 = createDisableSyncCommand({
    loadSettings,
    saveSettings,
    logger: logger2,
    enableCommand: USER_ENABLE
  });
});

// ../../packages/plugin-common/src/commands/folder-exclusion.ts
function createIgnoreFolderCommand(config) {
  return async (_args = []) => {
    try {
      const currentFolder = config.currentFolder?.() ?? process.cwd();
      const settings = await config.loadSettings();
      const withDefaults = { ...settings, excludedFolders: settings.excludedFolders ?? [] };
      const { settings: updatedSettings, alreadyExcluded } = addExcludedFolder(currentFolder, withDefaults);
      if (alreadyExcluded) {
        console.log("✓ This folder is already ignored");
        console.log(`   ${currentFolder}`);
        return;
      }
      await config.saveSettings(updatedSettings);
      console.log("✅ Folder added to ignore list");
      console.log(`   ${currentFolder}`);
      console.log("");
      console.log("\uD83D\uDEAB Zest will no longer track activity in this folder");
      if (config.unignoreCommand) {
        console.log(`\uD83D\uDCA1 Use ${config.unignoreCommand} to re-enable tracking`);
      }
    } catch (error) {
      config.logger.error("Failed to ignore folder", error);
      console.error("❌ Failed to ignore folder: " + (error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  };
}
function createUnignoreFolderCommand(config) {
  return async (_args = []) => {
    try {
      const currentFolder = config.currentFolder?.() ?? process.cwd();
      const settings = await config.loadSettings();
      const withDefaults = { ...settings, excludedFolders: settings.excludedFolders ?? [] };
      const { settings: updatedSettings, wasExcluded } = removeExcludedFolder(currentFolder, withDefaults);
      if (!wasExcluded) {
        console.log("✓ This folder is not in the ignore list");
        console.log(`   ${currentFolder}`);
        return;
      }
      await config.saveSettings(updatedSettings);
      console.log("✅ Folder removed from ignore list");
      console.log(`   ${currentFolder}`);
      console.log("");
      console.log("\uD83D\uDCCA Zest will now track activity in this folder");
    } catch (error) {
      config.logger.error("Failed to unignore folder", error);
      console.error("❌ Failed to unignore folder: " + (error instanceof Error ? error.message : "Unknown error"));
      process.exit(1);
    }
  };
}
var init_folder_exclusion2 = __esm(() => {
  init_folder_exclusion();
});

// src/commands/ignore-cli.ts
var exports_ignore_cli = {};
__export(exports_ignore_cli, {
  main: () => main10
});
var main10;
var init_ignore_cli = __esm(() => {
  init_folder_exclusion2();
  init_settings();
  init_runtime();
  init_user_commands();
  main10 = createIgnoreFolderCommand({
    loadSettings,
    saveSettings,
    logger: logger2,
    unignoreCommand: USER_UNIGNORE
  });
});

// src/commands/unignore-cli.ts
var exports_unignore_cli = {};
__export(exports_unignore_cli, {
  main: () => main11
});
var main11;
var init_unignore_cli = __esm(() => {
  init_folder_exclusion2();
  init_settings();
  init_runtime();
  main11 = createUnignoreFolderCommand({ loadSettings, saveSettings, logger: logger2 });
});

// ../../packages/plugin-common/src/auth/workspace.ts
function findWorkspaceByIndex(workspaces, index) {
  return workspaces[index - 1];
}
function findWorkspaceById(workspaces, id) {
  return workspaces.find((ws) => ws.id === id);
}
function findWorkspaceByName(workspaces, name) {
  const lowerInput = name.toLowerCase();
  return workspaces.find((ws) => ws.name.toLowerCase().includes(lowerInput));
}
function findWorkspace(workspaces, input) {
  const index = Number.parseInt(input, 10);
  if (!Number.isNaN(index) && index >= 1 && String(index) === input.trim()) {
    return findWorkspaceByIndex(workspaces, index);
  }
  if (validate_default(input)) {
    return findWorkspaceById(workspaces, input);
  }
  return findWorkspaceByName(workspaces, input);
}
var init_workspace = __esm(() => {
  init_dist_node();
});

// ../../packages/plugin-common/src/commands/workspace.ts
function createWorkspaceCommand(config) {
  const { logger, zest, loginCommand, workspaceCommand } = config;
  return async (args = []) => {
    try {
      const pluginConfig = await zest.config({ force: true });
      if (!pluginConfig) {
        console.log(`❌ Not authenticated — run ${loginCommand} first`);
        return;
      }
      const { workspaces, workspace: current } = pluginConfig;
      if (workspaces.length === 0) {
        console.log("❌ No workspaces found");
        console.log(`   Create one at: ${zest.webUrl("/app")}`);
        return;
      }
      if (args.length === 0) {
        if (current) {
          console.log(`Current: ${current.name}`);
          console.log("");
        }
        console.log("Available workspaces:");
        for (const [i, ws] of workspaces.entries()) {
          const marker = current?.id === ws.id ? "✓" : " ";
          console.log(`${marker} ${i + 1}. ${ws.name}`);
        }
        console.log("");
        console.log(`Switch: ${workspaceCommand} {number}`);
        return;
      }
      const selected = findWorkspace(workspaces, args[0]);
      if (!selected) {
        console.log("❌ Workspace not found");
        console.log(`   Run ${workspaceCommand} to see available workspaces`);
        process.exit(1);
        return;
      }
      const switched = await zest.auth.switchWorkspace(selected.id);
      await zest.config({ force: true });
      console.log(`✅ Switched to: ${switched.name}`);
    } catch (error) {
      logger.error("Workspace command failed", error);
      console.error("❌ Failed to manage workspace");
      if (error instanceof Error)
        console.error(`   ${error.message}`);
      process.exit(1);
    }
  };
}
var init_workspace2 = __esm(() => {
  init_workspace();
});

// src/commands/workspace-cli.ts
var exports_workspace_cli = {};
__export(exports_workspace_cli, {
  main: () => main12
});
var main12;
var init_workspace_cli = __esm(() => {
  init_workspace2();
  init_runtime();
  init_user_commands();
  main12 = createWorkspaceCommand({
    logger: logger2,
    zest,
    loginCommand: USER_LOGIN,
    workspaceCommand: USER_WORKSPACE
  });
});

// ../../packages/plugin-common/src/commands/privacy.ts
function parseArgs(args) {
  const result = {};
  for (const arg of args) {
    if (arg.startsWith("--approach=")) {
      const value = arg.slice("--approach=".length);
      if (["detection", "encryption", "hybrid"].includes(value)) {
        result.approach = value;
      }
    } else if (arg.startsWith("--aggressive=")) {
      result.aggressive = arg.slice("--aggressive=".length) === "true";
    } else if (arg.startsWith("--gitignore=")) {
      result.gitignore = arg.slice("--gitignore=".length) === "true";
    } else if (arg.startsWith("--zest-rules=")) {
      result.zestRules = arg.slice("--zest-rules=".length) === "true";
    } else if (arg.startsWith("--exclude=")) {
      result.exclude = arg.slice("--exclude=".length).replace(/^["']|["']$/g, "");
    } else if (arg.startsWith("--remove-exclude=")) {
      result.removeExclude = arg.slice("--remove-exclude=".length).replace(/^["']|["']$/g, "");
    }
  }
  return result;
}
function displaySettings(privacy, getStats, approachLine, bullet) {
  console.log(`
\uD83D\uDD12 Privacy Settings
`);
  console.log(approachLine);
  console.log(`${privacy.aggressiveMode ? "⚡" : "\uD83C\uDF3F"} Aggressive mode: ${privacy.aggressiveMode ? "enabled" : "disabled"}`);
  console.log(`${privacy.enableGitignore ? "✅" : "❌"} Respect .gitignore: ${privacy.enableGitignore ? "yes" : "no"}`);
  console.log(`${privacy.enableZestRules ? "✅" : "❌"} Respect .zest.rules: ${privacy.enableZestRules ? "yes" : "no"}`);
  if (privacy.customExclusionPatterns.length > 0) {
    console.log(`
\uD83D\uDCC1 Custom exclusion patterns (${privacy.customExclusionPatterns.length}):`);
    for (const pattern of privacy.customExclusionPatterns) {
      console.log(`   ${bullet} ${pattern}`);
    }
  } else {
    console.log(`
\uD83D\uDCC1 Custom exclusion patterns: none`);
  }
  const stats = getStats();
  if (stats) {
    console.log(`
\uD83D\uDCCA Session stats:`);
    console.log(`   ${bullet} Detections: ${stats.totalDetections}`);
    console.log(`   ${bullet} Files processed: ${stats.filesProcessed}`);
    console.log(`   ${bullet} Files excluded: ${stats.filesExcluded}`);
  }
  console.log(`
\uD83D\uDCA1 Use --help to see available options
`);
}
function displayEditableHelp(usage, bullet) {
  console.log(`
\uD83D\uDD12 Privacy Settings Command

Usage: ${usage} [options]

Options:
  --approach=<value>       detection | encryption | hybrid (kept for older settings)
                           Every approach replaces each secret with [REDACTED];
                           none can switch redaction off

  --aggressive=<bool>      Enable/disable aggressive detection mode
                           ${bullet} true  - More patterns, may have false positives
                           ${bullet} false - Default patterns only (recommended)

  --gitignore=<bool>       Respect .gitignore for file exclusion
                           ${bullet} true  - Skip files matching .gitignore patterns
                           ${bullet} false - Process all files

  --zest-rules=<bool>      Respect .zest.rules for file exclusion
                           ${bullet} true  - Use project .zest.rules file
                           ${bullet} false - Ignore .zest.rules

  --exclude=<pattern>      Add a custom glob exclusion pattern
                           Example: --exclude="*.secret.js"

  --remove-exclude=<pat>   Remove a custom exclusion pattern
                           Example: --remove-exclude="*.log"

Examples:
  ${usage}                           # View current settings
  ${usage} --aggressive=true         # Enable aggressive detection
  ${usage} --exclude="secrets/**"    # Exclude secrets directory
  ${usage} --approach=hybrid         # Use hybrid approach
`);
}
function displayHelp(usage) {
  console.log(`
\uD83D\uDD12 Privacy Settings Command

Usage: ${usage} [options]

Options:
  --aggressive=<bool>      Enable/disable aggressive detection mode
  --gitignore=<bool>       Respect .gitignore for file exclusion
  --zest-rules=<bool>      Respect .zest.rules for file exclusion
  --exclude=<pattern>      Add a custom glob exclusion pattern
  --remove-exclude=<pat>   Remove a custom exclusion pattern

Examples:
  ${usage}
  ${usage} --aggressive=true
  ${usage} --exclude="secrets/**"
`);
}
function createPrivacyCommand(config) {
  const editable = config.editableApproach;
  const arrow = editable?.arrow ?? "->";
  const bullet = editable?.bullet ?? "-";
  function approachLine(privacy) {
    const approach = privacy.approach ?? "detection";
    if (editable)
      return `${APPROACH_ICONS[approach]} Approach: ${approach}`;
    return `\uD83D\uDD0D Approach: ${config.showStoredApproach ? approach : "detection"}`;
  }
  return async (args = []) => {
    if (args.includes("--help") || args.includes("-h")) {
      if (editable)
        displayEditableHelp(config.usage, bullet);
      else
        displayHelp(config.usage);
      return;
    }
    try {
      const settings = await config.loadSettings();
      const privacy = settings.privacy ?? { ...config.defaultPrivacy };
      const parsedArgs = parseArgs(args);
      if (!editable && args.some((a) => a.startsWith("--approach="))) {
        console.log("❌ Approach cannot be changed — detection is the only supported mode");
        process.exit(1);
        return;
      }
      if (Object.keys(parsedArgs).length === 0) {
        displaySettings(privacy, config.getStats, approachLine(privacy), bullet);
        return;
      }
      const changes = [];
      if (parsedArgs.approach !== undefined) {
        privacy.approach = parsedArgs.approach;
        changes.push(`approach ${arrow} ${parsedArgs.approach}`);
      }
      if (parsedArgs.aggressive !== undefined) {
        privacy.aggressiveMode = parsedArgs.aggressive;
        changes.push(`aggressive mode ${arrow} ${parsedArgs.aggressive ? "enabled" : "disabled"}`);
      }
      if (parsedArgs.gitignore !== undefined) {
        privacy.enableGitignore = parsedArgs.gitignore;
        changes.push(`.gitignore respect ${arrow} ${parsedArgs.gitignore ? "enabled" : "disabled"}`);
      }
      if (parsedArgs.zestRules !== undefined) {
        privacy.enableZestRules = parsedArgs.zestRules;
        changes.push(`.zest.rules respect ${arrow} ${parsedArgs.zestRules ? "enabled" : "disabled"}`);
      }
      if (parsedArgs.exclude) {
        if (!privacy.customExclusionPatterns.includes(parsedArgs.exclude)) {
          privacy.customExclusionPatterns.push(parsedArgs.exclude);
          changes.push(`added exclusion: ${parsedArgs.exclude}`);
        } else {
          console.log(`ℹ️  Pattern already exists: ${parsedArgs.exclude}`);
        }
      }
      if (parsedArgs.removeExclude) {
        const index = privacy.customExclusionPatterns.indexOf(parsedArgs.removeExclude);
        if (index !== -1) {
          privacy.customExclusionPatterns.splice(index, 1);
          changes.push(`removed exclusion: ${parsedArgs.removeExclude}`);
        } else {
          console.log(`ℹ️  Pattern not found: ${parsedArgs.removeExclude}`);
        }
      }
      if (changes.length > 0) {
        settings.privacy = privacy;
        await config.saveSettings(settings);
        console.log(`✅ Privacy settings updated:
`);
        for (const change of changes) {
          console.log(`   ${bullet} ${change}`);
        }
        if (editable) {
          if (editable.privacyManager.isInitialized()) {
            await editable.privacyManager.updateSettings(privacy);
            console.log(`
\uD83D\uDD04 Privacy manager reloaded with new settings`);
          }
          console.log(`
\uD83D\uDCA1 Changes take effect on the next extraction
`);
        }
      }
    } catch (error) {
      config.logger.error("Failed to update privacy settings", error);
      if (editable) {
        console.error("❌ Failed to update privacy settings: " + (error instanceof Error ? error.message : "Unknown error"));
      } else {
        console.error("❌ Failed to update privacy settings");
        if (error instanceof Error)
          console.error(`   ${error.message}`);
      }
      process.exit(1);
    }
  };
}
var APPROACH_ICONS;
var init_privacy2 = __esm(() => {
  APPROACH_ICONS = {
    detection: "\uD83D\uDD0D",
    encryption: "#️⃣",
    hybrid: "\uD83D\uDD04"
  };
});

// src/commands/privacy-cli.ts
var exports_privacy_cli = {};
__export(exports_privacy_cli, {
  main: () => main13
});
var main13;
var init_privacy_cli = __esm(() => {
  init_privacy2();
  init_privacy_manager();
  init_settings();
  init_runtime();
  init_user_commands();
  main13 = createPrivacyCommand({
    loadSettings,
    saveSettings,
    logger: logger2,
    defaultPrivacy: DEFAULT_PRIVACY_SETTINGS,
    getStats: () => privacyManager.getStats(),
    usage: `${ZEST_FREEBUFF_CLI} privacy`
  });
});

// ../../packages/plugin-common/src/commands/dispatch.ts
function runCli(dispatch) {
  dispatch().catch((error) => {
    console.error("Fatal:", error);
    process.exit(1);
  });
}

// src/cli.ts
var COMMAND_IMPORTS = {
  install: () => Promise.resolve().then(() => (init_install_cli(), exports_install_cli)),
  uninstall: async () => ({ main: (await Promise.resolve().then(() => (init_install_cli(), exports_install_cli))).uninstallMain }),
  login: () => Promise.resolve().then(() => (init_login_cli(), exports_login_cli)),
  logout: () => Promise.resolve().then(() => (init_logout_cli(), exports_logout_cli)),
  status: () => Promise.resolve().then(() => (init_status_cli(), exports_status_cli)),
  sync: () => Promise.resolve().then(() => (init_sync_cli(), exports_sync_cli)),
  watch: () => Promise.resolve().then(() => (init_watch_cli(), exports_watch_cli)),
  standup: () => Promise.resolve().then(() => (init_standup_cli(), exports_standup_cli)),
  enable: () => Promise.resolve().then(() => (init_enable_cli(), exports_enable_cli)),
  disable: () => Promise.resolve().then(() => (init_disable_cli(), exports_disable_cli)),
  ignore: () => Promise.resolve().then(() => (init_ignore_cli(), exports_ignore_cli)),
  unignore: () => Promise.resolve().then(() => (init_unignore_cli(), exports_unignore_cli)),
  workspace: () => Promise.resolve().then(() => (init_workspace_cli(), exports_workspace_cli)),
  privacy: () => Promise.resolve().then(() => (init_privacy_cli(), exports_privacy_cli))
};
async function dispatch2() {
  const [cmdName, ...cmdArgs] = process.argv.slice(2);
  const loader = cmdName ? COMMAND_IMPORTS[cmdName] : undefined;
  if (!loader) {
    console.error(`Usage: zest-freebuff <${Object.keys(COMMAND_IMPORTS).join("|")}> [args...]`);
    process.exit(1);
    return;
  }
  const { main } = await loader();
  return main(cmdArgs);
}
runCli(dispatch2);
