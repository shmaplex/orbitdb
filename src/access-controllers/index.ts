/**
 * @module AccessControllers
 * @description
 * Provides a system for managing access controllers in OrbitDB.
 */

import type { IdentitiesInstance } from "../identities";
import type { EntryType } from "../oplog";
import IPFSAccessController from "./ipfs";
import OrbitDBAccessController from "./orbitdb";

/**
 * Represents a single Access Controller instance.
 * Responsible for deciding if an entry can be appended and managing its lifecycle.
 */
export interface AccessControllerInstance {
  canAppend: (entry: EntryType) => Promise<boolean>;
  address?: string;
  type?: string;
  write?: string[];
  close?: () => Promise<void>;
  drop?: () => Promise<void>;
  capabilities?: () => Promise<Record<string, Set<string>>>;
}

/**
 * Context provided to the inner function of a curried Access Controller factory.
 */
export interface AccessControllerContext {
  orbitdb: any;
  identities: IdentitiesInstance;
  address?: string;
  name?: string;
}

/**
 * Optional parameters passed to the outer function of a curried Access Controller.
 */
export interface AccessControllerParams {
  write?: string[];
  storage?: any;
  name?: string;
}

/**
 * A curried factory function for building Access Controllers.
 * Supports both JS-style curried usage and TS async usage.
 */
export type AccessControllerFactory = {
  /**
   * Outer factory: optionally accepts parameters, always returns a curried function
   * which takes a context and returns a Promise of the instance.
   */
  (params?: AccessControllerParams): (
    ctx: AccessControllerContext
  ) => Promise<AccessControllerInstance>;

  /** Static type property for registry and identification */
  type?: string;
};

/**
 * Utility type to extract the final AccessControllerInstance from a controller module.
 */
export type AccessControllerInstanceType<T> = T extends (
  params?: infer P
) => (ctx: infer C) => infer I
  ? Awaited<I>
  : T extends (ctx: infer C) => infer I
  ? Awaited<I>
  : never;

/**
 * A module definition for an Access Controller.
 * Supports three patterns:
 * 1. Curried factory: params => ctx => instance
 * 2. Single-stage async: ctx + params => instance
 * 3. Single-stage sync: ctx + params => instance
 */
export type AccessControllerModule = {
  type: string;
} & AccessControllerFactory;

/** Internal registry of available access controller modules. */
const accessControllers: Record<string, AccessControllerModule> = {};

/**
 * Retrieves a registered Access Controller module by its `type` string.
 * @throws If the controller type is not registered.
 */
export const getAccessController = (type: string): AccessControllerModule => {
  const controller = accessControllers[type];
  if (!controller) {
    throw new Error(`AccessController type '${type}' is not supported`);
  }
  return controller;
};

/**
 * Registers a new Access Controller module.
 * @throws If the type already exists or lacks a `.type` property.
 */
export const useAccessController = (
  accessController: AccessControllerModule
): void => {
  if (!accessController.type) {
    throw new Error(`AccessController must have a static 'type' property`);
  }
  if (accessControllers[accessController.type]) {
    throw new Error(
      `AccessController type '${accessController.type}' is already registered`
    );
  }
  accessControllers[accessController.type] = accessController;
};

// Register built-ins
useAccessController(IPFSAccessController);
useAccessController(OrbitDBAccessController);

/** Type helpers for built-in controllers. */
export type OrbitDBAccessControllerInstance = AccessControllerInstanceType<
  typeof OrbitDBAccessController
>;
export type IPFSAccessControllerInstance = AccessControllerInstanceType<
  typeof IPFSAccessController
>;

/** Exports */
export { IPFSAccessController, OrbitDBAccessController };
