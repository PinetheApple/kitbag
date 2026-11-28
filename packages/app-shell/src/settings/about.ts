import { BUNDLE_RULES } from '../toolBuild/bundleRules.ts';

export const SOURCE_LABEL = `${BUNDLE_RULES.release.host}/${BUNDLE_RULES.release.repo}`;
export const SOURCE_URL = `https://${SOURCE_LABEL}`;
export const LICENCE_URL = `${SOURCE_URL}/blob/main/LICENSE`;
export const LICENCE_NAME = 'GPLv3';
