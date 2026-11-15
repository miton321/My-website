import projectSupportImg from '../assets/images/project_support_agent_1794637822092.jpg';
import projectEcommerceImg from '../assets/images/project_ecommerce_bd_1794637822912.jpg';
import projectMarketingImg from '../assets/images/project_creative_marketing_1794637823206.jpg';

const SEED_ASSET_MAP: Record<string, string> = {
  'seed://project_support_agent': projectSupportImg,
  'seed://project_ecommerce_bd': projectEcommerceImg,
  'seed://project_creative_marketing': projectMarketingImg,
};

export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  return SEED_ASSET_MAP[url] ?? url;
}
