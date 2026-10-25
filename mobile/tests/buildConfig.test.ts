import {afterEach,expect,it,vi} from 'vitest';
import configuration from '../app.config';
const context={config:{name:'AIFekr',slug:'aifekr'}} as Parameters<typeof configuration>[0];
afterEach(()=>vi.unstubAllEnvs());
it('blocks installable builds without a backend and rejects insecure or placeholder origins',()=>{vi.stubEnv('EAS_BUILD_PROFILE','preview');for(const origin of ['', 'http://aifekr.test','https://staging.example.com','https://user:pass@aifekr.test','https://aifekr.test/api']){vi.stubEnv('EXPO_PUBLIC_API_URL',origin);expect(()=>configuration(context)).toThrow();}});
it('accepts a configured HTTPS build while retaining the approved package identifier',()=>{vi.stubEnv('EAS_BUILD_PROFILE','preview');vi.stubEnv('EXPO_PUBLIC_API_URL','https://api.aifekr.test');expect(configuration(context).android?.package).toBe('com.aifekr.app');});
