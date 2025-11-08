/**
 * @module AccessControllers
 * @description
 * Provides a system for managing access controllers. Supported access
 * controllers can be registered, retrieved, and instantiated. This module
 * supports both class-based and async factory-function controllers.
 */

import type { EntryType } from "../oplog";
import IPFSAccessController from "./ipfs";
import OrbitDBAccessController from "./orbitdb";

/**
 * Interface for an access controller instance.
 * Every instance must implement `canAppend`, which decides
 * whether a given entry can be appended.
 */
export interface AccessControllerInstance {
  /**
   * Determines whether a given log entry is allowed to be appended.
   */
  canAppend: (entry: EntryType) => Promise<boolean>;

  /** Optional address of the access controller */
  address?: string;

  /** The controller type identifier (e.g., 'ipfs', 'orbitdb') */
  type: string;

  /** Array of authorized writer identities */
  write?: string[];

  /** Optional cleanup method */
  close?: () => Promise<void>;

  /** Optional method to drop the access controller state */
  drop?: () => Promise<void>;
}

/**
 * Type representing an Access Controller class/module.
 * Must include a static `type` property.
 * Can be a class, a function returning AccessControllerInstance,
 * or an async factory returning Promise<AccessControllerInstance>.
 */
export type AccessControllerModule = {
  type: string;
  (...args: any[]):
    | AccessControllerInstance
    | Promise<AccessControllerInstance>;
};

/** Registry of access controllers by type */
const accessControllers: Record<string, AccessControllerModule> = {};

/**
 * Type representing the registered access controller types.
 */
export type AccessControllerType = keyof typeof accessControllers;

/**
 * Gets an access controller module by type.
 * @param type - The type of the access controller.
 * @returns The access controller module.
 * @throws Will throw if the type is not registered.
 */
export const getAccessController = (type: string): AccessControllerModule => {
  const controller = accessControllers[type];
  if (!controller) {
    throw new Error(`AccessController type '${type}' is not supported`);
  }
  return controller;
};

/**
 * Registers a new access controller module.
 * @param accessController - A compatible access controller module.
 * @throws Will throw if the module lacks a `type` property or
 * if the type is already registered.
 */
export const useAccessController = (
  accessController: AccessControllerModule
): void => {
  if (!accessController.type) {
    throw new Error(`AccessController must have 'type' property`);
  }

  if (accessControllers[accessController.type]) {
    throw new Error(
      `AccessController type '${accessController.type}' is already registered`
    );
  }

  accessControllers[accessController.type] = accessController;
};

// --- Register built-in access controllers ---
useAccessController(IPFSAccessController);
useAccessController(OrbitDBAccessController);

/**
 * TypeScript-friendly instance types for database usage.
 */
export type OrbitDBAccessControllerInstance = Awaited<
  ReturnType<typeof OrbitDBAccessController>
>;
export type IPFSAccessControllerInstance = Awaited<
  ReturnType<typeof IPFSAccessController>
>;

/** Export built-in access controllers */
export { IPFSAccessController, OrbitDBAccessController };
