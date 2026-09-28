// أداة بسيطة لمزامنة إعدادات الموقع (الأيقونات، الشعار، إلخ) بين صفحة
// الإعدادات والمكونات اللي بتعرضها (الهيدر، المساعد الذكي) بدون الحاجة
// لعمل تسجيل خروج/دخول عشان التغيير يظهر.
export const APP_SETTINGS_UPDATED_EVENT = 'app-settings-updated';

export function notifyAppSettingsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT));
  }
}
