"use client";
import { DEFAULT_RULES, type Rules } from "@/engine/rules";
import { useLocalStorage } from "./storage";

export const RULES_KEY = "bjt.rules";
export const useRules = () => useLocalStorage<Rules>(RULES_KEY, DEFAULT_RULES);
