import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOrigin, request, signIn, profile,logout,readDraft,saveDraft,saveOfflineQuiz,readOfflineQuiz } from '../src/api';
const store = vi.hoisted(() => ({ getItemAsync:vi.fn(), setItemAsync:vi.fn(), deleteItemAsync:vi.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY:1 }));
vi.mock('expo-secure-store',()=>store);
vi.mock('../src/offlineVault',()=>({removeVault:vi.fn()}));
beforeEach(()=>{
  vi.resetAllMocks(); vi.stubGlobal('__DEV__',false); vi.stubEnv('EXPO_PUBLIC_API_URL','https://aifekr.test');
  store.getItemAsync.mockResolvedValue(JSON.stringify({accessToken:'token',refreshToken:'refresh',sessionId:'id',expiresIn:900,refreshExpiresAt:new Date(Date.now()+86400000).toISOString(),expiresAt:Date.now()+900000}));
});
describe('native API safety',()=>{
  it('reports the missing backend configuration before sending login credentials',async()=>{vi.stubEnv('EXPO_PUBLIC_API_URL','');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(signIn('person@example.test','password','fa')).rejects.toThrow('بک‌اند');expect(fetcher).not.toHaveBeenCalled();expect(store.setItemAsync).not.toHaveBeenCalled();});
  it('validates email locally and trims it without modifying the password',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:401}));vi.stubGlobal('fetch',fetcher);await expect(signIn('bad','password','en')).rejects.toThrow('valid email');expect(fetcher).not.toHaveBeenCalled();await expect(signIn('  person@example.test  ',' password ','en')).rejects.toThrow();expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({email:'person@example.test',password:' password '});});
  it('protects offline quiz answers by session and clears them on logout',async()=>{
    const session={accessToken:'token',refreshToken:'refresh',sessionId:'quiz-owner',expiresIn:900,refreshExpiresAt:new Date(Date.now()+86400000).toISOString(),expiresAt:Date.now()+900000};
    const values=new Map<string,string>([['aifekr.session.v2',JSON.stringify(session)]]);
    store.getItemAsync.mockImplementation(async(key:string)=>values.get(key)||null);
    store.setItemAsync.mockImplementation(async(key:string,value:string)=>{values.set(key,value);});
    store.deleteItemAsync.mockImplementation(async(key:string)=>{values.delete(key);});
    const data={quizId:'quiz-id',quizHash:'a'.repeat(64),serverRevision:2,answers:[1,null]};
    await saveOfflineQuiz(data);expect(await readOfflineQuiz()).toEqual(data);
    expect(store.setItemAsync).toHaveBeenCalledWith('aifekr.quiz.quiz-owner',JSON.stringify(data),{keychainAccessible:store.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
    values.set('aifekr.session.v2',JSON.stringify({...session,sessionId:'another-session'}));expect(await readOfflineQuiz()).toBeNull();
    values.set('aifekr.session.v2',JSON.stringify(session));vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));await logout();expect(values.has('aifekr.quiz.quiz-owner')).toBe(false);
  });
  it.each(['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com?token=secret','https://example.com#fragment'])('rejects unsafe API origin %s',origin=>expect(()=>apiOrigin(origin,false)).toThrow());
  it('allows loopback HTTP only in development',()=>{
    expect(apiOrigin('http://localhost:3000',true)).toBe('http://localhost:3000');
    expect(()=>apiOrigin('http://localhost:3000',false)).toThrow();
  });
  it('sends native session only to configured origin without following redirects',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true}))); vi.stubGlobal('fetch',fetcher);
    await request('/api/user/profile','fa');
    expect(fetcher).toHaveBeenCalledWith('https://aifekr.test/api/user/profile',expect.objectContaining({credentials:'omit',redirect:'error'}));
    expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token');
    expect(fetcher.mock.calls[0][1].headers.get('Cookie')).toBe('lang=fa');
  });
  it('clears rejected tokens and propagates authentication failure',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'Expired'}),{status:401})));
    await expect(request('/api/user/profile','en')).rejects.toMatchObject({status:401});
    expect(store.deleteItemAsync).toHaveBeenCalled();
  });
  it('does not send unauthenticated private requests',async()=>{
    store.getItemAsync.mockResolvedValue(null); const fetcher=vi.fn(); vi.stubGlobal('fetch',fetcher);
    await expect(request('/api/user/profile','en')).rejects.toMatchObject({status:401}); expect(fetcher).not.toHaveBeenCalled();
  });
  it('clears a rejected token even when an upstream proxy returns HTML',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>Unauthorized</html>',{status:401})));
    await expect(request('/api/user/profile','en')).rejects.toMatchObject({status:401});
    expect(store.deleteItemAsync).toHaveBeenCalled();
  });
  it('does not save invalid login results',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true}))));
    await expect(signIn('person@example.test','password','tr')).rejects.toThrow(); expect(store.setItemAsync).not.toHaveBeenCalled();
  });
  it('requires spendable balance instead of silently using personal credits',()=>{
    expect(()=>profile.parse({user:{name:'Person',plan:'FREE',credits:500}})).toThrow();
    expect(profile.parse({user:{name:'Person',plan:'FREE',credits:500,displayCredits:100}}).user.displayCredits).toBe(100);
  });
  it('serializes concurrent expiry refreshes and saves both tokens together',async()=>{
    const old={accessToken:'old',refreshToken:'old-refresh',sessionId:'id',expiresIn:900,refreshExpiresAt:new Date(Date.now()+86400000).toISOString(),expiresAt:0};
    store.getItemAsync.mockResolvedValue(JSON.stringify(old));
    const next={...old,accessToken:'new',refreshToken:'new-refresh'};
    const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/refresh')?next:{ok:true})));vi.stubGlobal('fetch',fetcher);
    await Promise.all([request('/api/user/profile','en'),request('/api/notifications','en')]);
    expect(fetcher.mock.calls.filter(call=>call[0].endsWith('/refresh'))).toHaveLength(1);
    expect(store.setItemAsync).toHaveBeenCalledTimes(1);
    const saved=JSON.parse(store.setItemAsync.mock.calls[0][1]);expect(saved.accessToken).toBe('new');expect(saved.refreshToken).toBe('new-refresh');
  });
  it('clears local secrets even if server revocation is unreachable',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Offline')));
    expect(await logout()).toEqual({revoked:false});expect(store.deleteItemAsync).toHaveBeenCalled();
  });
  it('still revokes the server session when offline-file cleanup fails',async()=>{
    const vault=await import('../src/offlineVault');vi.mocked(vault.removeVault).mockRejectedValueOnce(Error('Synthetic filesystem failure'));
    const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);
    expect(await logout()).toEqual({revoked:true,localCleared:false});expect(fetcher.mock.calls[0][1].method).toBe('DELETE');expect(store.deleteItemAsync).toHaveBeenCalledWith('aifekr.session.v2');
  });
  it('stores Unicode drafts in bounded encrypted chunks and clears them on logout',async()=>{
    const storage=new Map<string,string>();storage.set('aifekr.session.v2',JSON.stringify({accessToken:'token',refreshToken:'refresh',sessionId:'draft-session',expiresIn:900,refreshExpiresAt:'2026-12-01',expiresAt:Date.now()+900000}));
    store.getItemAsync.mockImplementation(async(key:string)=>storage.get(key)||null);store.setItemAsync.mockImplementation(async(key:string,value:string)=>{storage.set(key,value);});store.deleteItemAsync.mockImplementation(async(key:string)=>{storage.delete(key);});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
    const text='سلام 🌍 '.repeat(300);await saveDraft(text,'draft-session');expect((await readDraft())?.text).toBe(text);expect([...storage.entries()].filter(([key])=>/draft.*\.\d+$/.test(key)).every(([,value])=>new TextEncoder().encode(value).byteLength<2000)).toBe(true);
    await saveDraft('short','draft-session');expect((await readDraft())?.text).toBe('short');expect(storage.has('aifekr.draft.draft-session.1')).toBe(false);
    await logout();expect([...storage.keys()].some(key=>key.startsWith('aifekr.draft.'))).toBe(false);
  });
  it('does not store an old session draft under a new session identity',async()=>{await saveDraft('old account text','another-session');expect(store.setItemAsync).not.toHaveBeenCalled();});
});
