"use client";
import React from 'react';
import { User, Mail, Shield, Edit, Save, Camera, Key, Bell } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Me = { id:string; email:string; phone?:string; hasPassword?:boolean; firstName?:string; lastName?:string; role?:string };

export default function ProfilePage(){
  React.useEffect(() => {
    document.title = 'پروفایل کاربری | Arzesh ERP';
  }, []);

  const [me,setMe]=React.useState<Me|null>(null);
  const [edit,setEdit]=React.useState<Partial<Me>>({});
  const [saving,setSaving]=React.useState(false);
  const [activeTab, setActiveTab] = React.useState('profile');
  const [sendingOtp, setSendingOtp] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [otpExpiresAt, setOtpExpiresAt] = React.useState<string | null>(null);
  // no mock otp exposure
  const [mockOtp, setMockOtp] = React.useState<string | null>(null);
  const token = typeof window!=='undefined'? localStorage.getItem('token'):null;

  React.useEffect(()=>{ (async ()=>{
    if (!token) return;
    try{ 
      const r = await fetch(`${API}/auth/me`, { headers:{ Authorization:`Bearer ${token}` } }); 
      if (!r.ok) {
        console.error('Failed to fetch user profile');
        return;
      }
      const data = await r.json(); 
      setMe(data); 
      setEdit({ firstName:data?.firstName||'', lastName:data?.lastName||'' }); 
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  })(); }, [token]);

  async function save(){ 
    if(!me) return; 
    setSaving(true); 
    try{ 
      const response = await fetch(`${API}/users/me`, { 
        method:'PATCH', 
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, 
        body: JSON.stringify({ firstName: edit.firstName, lastName: edit.lastName }) 
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      setMe(prev => prev ? {...prev, firstName: edit.firstName, lastName: edit.lastName} : prev);
      alert('اطلاعات با موفقیت ذخیره شد'); 
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('خطا در ذخیره اطلاعات');
    } finally{ 
      setSaving(false); 
    }
  }

  const getRoleDisplay = (role?: string) => {
    switch(role) {
      case 'ADMIN': return { label: 'مدیر سیستم', color: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' };
      case 'MANAGER': return { label: 'مدیر', color: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' };
      case 'EXPERT': return { label: 'متخصص', color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' };
      case 'USER': return { label: 'کاربر عادی', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' };
      default: return { label: 'نامشخص', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' };
    }
  };

  const tabs = [
    { id: 'profile', label: 'اطلاعات شخصی', icon: User },
    { id: 'security', label: 'امنیت', icon: Key },
    { id: 'notifications', label: 'اعلان‌ها', icon: Bell },
  ];

  if(!me) return (
    <div className="flex justify-center items-center min-h-96">
      <div className="text-center">
        <div className="mx-auto mb-4 border-b-2 border-blue-600 rounded-full w-12 h-12 animate-spin"></div>
        <p className="text-gray-600 dark:text-gray-400">در حال بارگذاری...</p>
      </div>
    </div>
  );

  const roleInfo = getRoleDisplay(me.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex justify-center items-center bg-gradient-to-br from-blue-500 to-purple-500 rounded-full w-16 h-16">
              <User className="w-8 h-8 text-white" />
            </div>
            <button className="-right-1 -bottom-1 absolute flex justify-center items-center bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 border-2 border-gray-200 dark:border-gray-700 rounded-full w-6 h-6 transition-colors">
              <Camera className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-2xl">
              {me.firstName || me.lastName ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : 'کاربر ارزش ERP'}
            </h1>
            <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              {me.email}
            </p>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium mt-2 ${roleInfo.color}`}>
              <Shield className="w-3 h-3" />
              {roleInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden">
        <div className="flex border-gray-200 dark:border-gray-700 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/50'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">اطلاعات شخصی</h2>
              <Edit className="w-5 h-5 text-gray-400" />
            </div>

            <div className="gap-6 grid md:grid-cols-2">
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  نام
                </label>
                <input 
                  value={edit.firstName||''} 
                  onChange={e=>setEdit(s=>({...s, firstName:e.target.value}))} 
                  className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100 transition-colors"
                  placeholder="نام خود را وارد کنید"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  نام خانوادگی
                </label>
                <input 
                  value={edit.lastName||''} 
                  onChange={e=>setEdit(s=>({...s, lastName:e.target.value}))} 
                  className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100 transition-colors"
                  placeholder="نام خانوادگی خود را وارد کنید"
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                ایمیل
              </label>
              <input 
                value={me.email} 
                disabled
                className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg w-full text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-gray-500 dark:text-gray-400 text-xs">
                ایمیل قابل تغییر نیست
              </p>
            </div>

            <div>
              <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                نقش سیستمی
              </label>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${roleInfo.color}`}>
                  <Shield className="w-4 h-4" />
                  {roleInfo.label}
                </span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">
                  نقش توسط مدیر سیستم تعیین می‌شود
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                disabled={saving} 
                onClick={save} 
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 hover:from-blue-700 to-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-sm px-6 py-3 rounded-lg font-medium text-white transition-all duration-200 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">تنظیمات امنیتی</h2>
            {me?.phone ? (
              <div className="space-y-3 bg-blue-50/50 dark:bg-blue-950/50 p-4 border border-blue-200/50 dark:border-blue-800/50 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200">تغییر رمز عبور با تایید پیام‌رسان بله</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">شماره ثبت‌شده: <span className="font-mono">{me.phone}</span></p>
                <div className="flex gap-2">
                  <button
                    disabled={sendingOtp}
                    onClick={async ()=>{
                      try{
                        setSendingOtp(true);
                        const res = await fetch(`${API}/auth/send-otp`, {
                          method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
                          body: JSON.stringify({ phone: me.phone, purpose: 'change' })
                        });
                        const data = await res.json().catch(()=>({}));
                        if(!res.ok) {
                          if (res.status === 404) throw new Error('کاربری با این شماره یافت نشد');
                          throw new Error(data.message || 'ارسال کد ناموفق بود');
                        }
                        setOtpSent(true);
                        setOtpExpiresAt(data.expiresAt || null);
                        setMockOtp(null);
                      }catch(err:any){ alert(err.message); }
                      finally{ setSendingOtp(false); }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white text-sm"
                  >
                    {otpSent? 'ارسال مجدد کد' : 'ارسال کد تایید'}
                  </button>
                  {otpExpiresAt && <span className="self-center text-gray-500 text-xs">انقضا: {new Date(otpExpiresAt).toLocaleTimeString()}</span>}
                  {/* no mock otp display */}
                </div>
                {otpSent && (
                  <div className="gap-3 grid md:grid-cols-2">
                    <input
                      placeholder="کد تایید"
                      value={otp}
                      onChange={(e)=>setOtp(e.target.value.replace(/[^0-9]/g,''))}
                      className="bg-white dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    />
                    <input
                      placeholder="رمز عبور جدید"
                      type="password"
                      value={newPassword}
                      onChange={(e)=>setNewPassword(e.target.value)}
                      className="bg-white dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    />
                    <div className="flex justify-end md:col-span-2">
                      <button
                        onClick={async()=>{
                          try{
                            if(!/^\d{4,6}$/.test(otp)) throw new Error('کد تایید نامعتبر است');
                            if(newPassword.length<6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد');
                            const res = await fetch(`${API}/auth/change-password`, {
                              method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
                              body: JSON.stringify({ otp, newPassword })
                            });
                            const data = await res.json().catch(()=>({}));
                            if(!res.ok) throw new Error(data.message || 'تغییر رمز ناموفق بود');
                            alert('رمز عبور با موفقیت تغییر کرد');
                            setOtp(''); setNewPassword(''); setOtpSent(false); setOtpExpiresAt(null); setMockOtp(null);
                          }catch(err:any){ alert(err.message); }
                        }}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white text-sm"
                      >
                        تایید و تغییر رمز
                      </button>
                    </div>
                  </div>
                )}
                {!me?.hasPassword && (
                  <p className="text-amber-700 dark:text-amber-300 text-sm">پیشنهاد می‌شود برای افزایش امنیت، رمز عبور تنظیم کنید.</p>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/50 dark:bg-amber-950/50 p-4 border border-amber-200/50 dark:border-amber-800/50 rounded-lg">
                <h3 className="mb-2 font-semibold text-amber-800 dark:text-amber-200">شماره موبایل ثبت نشده است</h3>
                <p className="text-amber-700 dark:text-amber-300 text-sm">برای استفاده از تغییر رمز با بله، لطفاً با مدیر سیستم تماس بگیرید تا شماره موبایل شما ثبت شود.</p>
              </div>
            )}

            <div className="gap-4 grid">
              <div className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">احراز هویت دو مرحله‌ای</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">افزایش امنیت حساب کاربری</p>
                </div>
                <button className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 text-sm">
                  غیرفعال
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">تنظیمات اعلان‌ها</h2>
            
            <div className="space-y-4">
              {[
                { title: 'اعلان‌های سیستم', description: 'دریافت اعلان‌های مهم سیستم', enabled: true },
                { title: 'اعلان واگذاری', description: 'اطلاع از واگذاری‌های جدید', enabled: true },
                { title: 'گزارش‌های دوره‌ای', description: 'دریافت گزارش‌های هفتگی', enabled: false },
              ].map((notification, index) => (
                <div key={index} className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{notification.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{notification.description}</p>
                  </div>
                  <label className="inline-flex relative items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={notification.enabled} />
                    <div className="peer after:top-[2px] after:left-[2px] after:absolute bg-gray-200 after:bg-white dark:bg-gray-700 peer-checked:bg-blue-600 after:border after:border-gray-300 dark:border-gray-600 peer-checked:after:border-white rounded-full after:rounded-full peer-focus:outline-none dark:peer-focus:ring-blue-800 peer-focus:ring-4 peer-focus:ring-blue-300 w-11 after:w-5 h-6 after:h-5 after:content-[''] after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
