import { onAuthStateChanged, type User } from 'firebase/auth';
import { Eye, Minimize2, PanelRight } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountInfoView } from './components/AccountInfoView';
import { EditorToolbar } from './components/EditorToolbar';
import { FarmerSettingsView } from './components/FarmerSettingsView';
import { LoginView } from './components/LoginView';
import { OverviewAndDevicesView } from './components/OverviewAndDevicesView';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SchematicCanvas } from './components/SchematicCanvas';
import { SensorDetailsView } from './components/SensorDetailsView';
import { ToolboxPanel, renderToolboxIcon } from './components/ToolboxPanel';
import { TopNav } from './components/TopNav';
import { TOOLBOX_ITEMS } from './data/seedData';
import { auth, signOutAccount, syncAuthenticatedUserAccount } from './firebase';
import { useGharsStore } from './store/useGharsStore';
import type { ActiveDragPayload, ToolboxItemType } from './types/ghars';

export default function App() {
  const store = useGharsStore();
  const {
    shellSection,
    setShellSection,
    isFarmerPreview,
    setIsFarmerPreview,
    isFullscreen,
    hideEditorPanels,
    setHideEditorPanels,
    exitFullscreen,
    activeFarmer,
    activeFarm,
    toastMessage,
  } = store;

  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const syncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        syncedUidRef.current = null;
        return;
      }
      if (syncedUidRef.current !== user.uid) {
        syncedUidRef.current = user.uid;
        void syncAuthenticatedUserAccount(user).catch((err) => {
          console.error('Failed to sync authenticated account:', err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutAccount();
      setIsFarmerPreview(false);
      setShellSection('editor');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, [setIsFarmerPreview, setShellSection]);

  const [activeDrag, setActiveDrag] = useState<ActiveDragPayload | null>(null);
  const dropHandlerRef = useRef<
    ((payload: ActiveDragPayload, clientX: number, clientY: number) => boolean) | null
  >(null);

  const registerDropHandler = useCallback(
    (handler: ((payload: ActiveDragPayload, clientX: number, clientY: number) => boolean) | null) => {
      dropHandlerRef.current = handler;
    },
    []
  );

  const handleStartToolboxDrag = useCallback(
    (itemType: ToolboxItemType, label: string, e: React.PointerEvent) => {
      setActiveDrag({
        itemType,
        label,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    []
  );

  useEffect(() => {
    if (!activeDrag) return;

    const onMove = (e: PointerEvent) => {
      setActiveDrag((prev) =>
        prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null
      );
    };

    const onUp = (e: PointerEvent) => {
      dropHandlerRef.current?.(activeDrag, e.clientX, e.clientY);
      setActiveDrag(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDrag(null);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeDrag]);

  const activeDragMeta = activeDrag
    ? TOOLBOX_ITEMS.find((i) => i.itemType === activeDrag.itemType)
    : null;

  const showFullScreenEditor = isFullscreen && shellSection === 'editor';
  const showSidePanels = !isFarmerPreview && !(showFullScreenEditor && hideEditorPanels);

  if (authLoading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen w-screen bg-[#F5F7F5] text-[#0F1F18] flex items-center justify-center p-6"
      >
        <div className="bg-white border border-[#DCE3DD] rounded-2xl px-6 py-5 shadow-xs text-xs font-semibold text-[#475569]">
          جارٍ التحقق من جلسة تسجيل الدخول...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView />;
  }

  return (
    <div
      dir="rtl"
      className={`${
        showFullScreenEditor ? 'fixed inset-0 z-[1400]' : 'h-screen w-screen'
      } flex flex-col overflow-hidden bg-[#F5F7F5] text-[#0F1F18]`}
    >
      {!showFullScreenEditor && (
        <TopNav
          shellSection={shellSection}
          onSelectSection={(sec) => {
            setShellSection(sec);
            if (sec !== 'editor' && isFarmerPreview) {
              setIsFarmerPreview(false);
            }
          }}
          isFarmerPreview={isFarmerPreview}
          onToggleFarmerPreview={() => setIsFarmerPreview((v) => !v)}
          farmers={store.activeWorkspace.farmers}
          activeFarmerId={activeFarmer?.id ?? ''}
          onSelectFarmer={store.selectFarmer}
          onAddFarmer={store.addFarmer}
          accountLabel={currentUser.displayName || currentUser.email || 'الحساب'}
          onSignOut={handleSignOut}
        />
      )}

      {shellSection === 'editor' ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {!(showFullScreenEditor && hideEditorPanels) && <EditorToolbar store={store} />}

          <div className="flex-1 flex min-h-0 overflow-hidden">
            {showSidePanels && <ToolboxPanel onStartToolboxDrag={handleStartToolboxDrag} />}

            <main className="flex-1 flex min-w-0 min-h-0 relative">
              <SchematicCanvas
                store={store}
                activeDrag={activeDrag}
                onRegisterDropHandler={registerDropHandler}
              />

              {/* Floating Bar in Pure Full-Screen Layout Mode */}
              {showFullScreenEditor && hideEditorPanels && (
                <div className="absolute top-3 right-3 z-[1200] flex items-center gap-2 bg-white/95 backdrop-blur border border-[#DCE3DD] rounded-xl px-3 py-1.5 shadow-md text-xs">
                  <span className="font-bold text-[#0F1F18]">
                    {activeFarmer?.name ?? 'غرس'}
                    {activeFarm ? ` · ${activeFarm.name}` : ''}
                  </span>
                  <span className="text-[#CBD5E1]">|</span>
                  <button
                    type="button"
                    onClick={() => setHideEditorPanels(false)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DCE3DD] hover:border-[#15803D] text-[#0F1F18] font-medium cursor-pointer"
                  >
                    <PanelRight size={13} className="text-[#15803D]" />
                    <span>إظهار الأدوات والألواح</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFarmerPreview((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                      isFarmerPreview
                        ? 'bg-[#15803D] text-white'
                        : 'border border-[#DCE3DD] hover:border-[#0F1F18] text-[#0F1F18]'
                    }`}
                  >
                    <Eye size={13} />
                    <span>{isFarmerPreview ? 'العودة للمحرّر' : 'معاينة كفلاح'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={exitFullscreen}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F1F18] text-white hover:bg-[#1E2F26] font-semibold cursor-pointer"
                  >
                    <Minimize2 size={13} />
                    <span>خروج (Esc)</span>
                  </button>
                </div>
              )}
            </main>

            {showSidePanels && <PropertiesPanel store={store} />}
          </div>
        </div>
      ) : shellSection === 'devices' ? (
        <OverviewAndDevicesView store={store} />
      ) : shellSection === 'sensor-details' ? (
        <SensorDetailsView store={store} />
      ) : shellSection === 'account-info' ? (
        <AccountInfoView user={currentUser} onSignOut={handleSignOut} />
      ) : (
        <FarmerSettingsView store={store} />
      )}

      {activeDrag && activeDragMeta && (
        <div
          style={{
            left: activeDrag.clientX,
            top: activeDrag.clientY,
            transform: 'translate(-50%, -115%)',
          }}
          className="fixed z-[2000] pointer-events-none flex flex-col items-center"
        >
          <div
            style={{ borderColor: activeDragMeta.accentColor }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border-2 shadow-lg text-xs font-bold text-[#0F1F18]"
          >
            {renderToolboxIcon(activeDrag.itemType, activeDragMeta.accentColor)}
            <span>{activeDrag.label}</span>
          </div>
          <div
            style={{ backgroundColor: activeDragMeta.accentColor }}
            className="w-2.5 h-2.5 rounded-full border-2 border-white shadow mt-0.5"
          />
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[2100] px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border ${
            toastMessage.tone === 'success'
              ? 'bg-[#0F1F18] text-white border-[#15803D]'
              : toastMessage.tone === 'warn'
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-white text-[#0F1F18] border-[#DCE3DD]'
          }`}
        >
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}
