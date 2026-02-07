import {getRequestConfig} from 'next-intl/server';
import {headers} from 'next/headers';

export default getRequestConfig(async ({locale}) => {
  // Get the preferred locale from cookie or fallback to the detected locale
  const headersList = await headers();
  const preferredLocale = headersList.get('cookie')?.match(/preferred-locale=([^;]+)/)?.[1];
  
  const finalLocale = preferredLocale || locale || 'en';

  return {
    locale: finalLocale,
    messages: (await import(`./messages/${finalLocale}.json`)).default
  };
});
