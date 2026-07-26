'use client';

import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, ArrowLeft, Check, Clipboard, Heart } from 'lucide-react';
import { useStorefront } from '../context/StorefrontContext';
import { useFavorites } from '../context/FavoritesContext';
import {
  resolveStockStatus,
  isPurchasable,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_CLASSES,
} from '../lib/stock-status';

interface Product {
  ItemID: string;
  Product: string;
  USD: number;
  Bs: number;
  Category: string;
  Collection: string;
  Image: string;
  Description: string;
  Stock: number;
}

interface ProductDetailProps {
  product: Product;
  variants?: any[];
  onAddToCart: (product: any, quantity: number) => void;
  onCheckout: (product: any, quantity: number) => void;
  onBack: () => void;
}

export default function ProductDetail({ product, variants, onAddToCart, onCheckout, onBack }: ProductDetailProps) {
  const { assets } = useStorefront();
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(product.ItemID);

  // Dashboard-editable (Imagenes y banner -> Shipping Price Message). Only
  // active assets reach the storefront, so toggling it off hides the line.
  const shippingPriceMessage = (assets || []).find(
    (a: any) => a.asset_type === 'shipping_price_message',
  )?.html_content?.trim();

  const hasVariants = variants && variants.length > 0 && variants.some((v: any) => v.variant_name !== 'Default');

  const [quantity, setQuantity] = useState(hasVariants ? 1 : 1);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);

  const rawMaxStock = hasVariants
    ? (selectedVariant ? selectedVariant.stock_count : 0)
    : product.Stock;

  // The operator's override wins over the count for how this is presented, and
  // 'unavailable' / 'out_of_stock' block the sale outright.
  const stockStatus = resolveStockStatus((product as any).StockStatus, rawMaxStock);
  const purchasable = isPurchasable((product as any).StockStatus, rawMaxStock);
  const maxStock = purchasable ? rawMaxStock : 0;

  const displayImage = (selectedVariant && selectedVariant.image_path)
    ? selectedVariant.image_path
    : product.Image;

  const handleVariantSelect = (v: any) => {
    setSelectedVariant(v);
    if (v.stock_count > 0) {
      setQuantity(1);
    } else {
      setQuantity(0);
    }
  };

  const handleAddToCart = () => {
    onAddToCart({ ...product, variant: selectedVariant }, quantity);
  };

  const paymentMethods = [
    { 
      name: 'Efectivo', 
      icon: (
        <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
          <rect x="2" y="8" width="28" height="10" rx="2" fill="#82DCC7"/>
          <rect x="2" y="18" width="28" height="6" rx="2" fill="#74CBB4"/>
          <ellipse cx="16" cy="13" rx="4" ry="5" fill="#74CBB4"/>
          <rect x="2" y="8" width="28" height="16" rx="2" stroke="#3b65d8" strokeWidth="1.5"/>
        </svg>
      )
    },
    { 
      name: 'Pago Móvil', 
      icon: (
        <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
          <rect x="3" y="6" width="8" height="18" rx="2" fill="#69d3cc" stroke="#3b65d8" strokeWidth="1.5"/>
          <rect x="6" y="8" width="4" height="1" rx="0.5" fill="#3b65d8"/>
          <circle cx="8" cy="23" r="1" fill="#3b65d8"/>
          <rect x="21" y="6" width="8" height="18" rx="2" fill="#f9a8a8" stroke="#3b65d8" strokeWidth="1.5"/>
          <rect x="24" y="8" width="4" height="1" rx="0.5" fill="#3b65d8"/>
          <circle cx="26" cy="23" r="1" fill="#3b65d8"/>
        </svg>
      )
    },
    { 
      name: 'Cashea', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="24" height="24">
          <rect x="30" y="30" width="940" height="940" rx="220" ry="220" fill="#FFF212" />
          <circle cx="500" cy="520" r="320" fill="#373435"/>
          <circle cx="500" cy="520" r="170" fill="#FFF212"/>
          <rect x="665" y="420" width="300" height="200" fill="#FFF212" />
          <rect x="470" y="112" width="60" height="220" fill="#FFF212" />
          <rect x="640" y="440" width="40" height="40" fill="#FFF212" />
        </svg>
      )
    },
    { 
      name: 'Debito', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
          <path d="M894.509511 249.605689H330.752a37.660444 37.660444 0 0 0-37.546667 37.762844v342.448356a37.660444 37.660444 0 0 0 37.546667 37.762844h563.757511a37.660444 37.660444 0 0 0 37.558045-37.762844V287.368533a37.660444 37.660444 0 0 0-37.558045-37.762844z" fill="#CCCCCC" />
          <path d="M293.216711 333.585067H932.067556v97.655466H293.216711z" fill="#4D4D4D" />
          <path d="M688.685511 388.278044H124.928a37.660444 37.660444 0 0 0-37.546667 37.762845v342.448355a37.660444 37.660444 0 0 0 37.546667 37.762845h563.757511a37.660444 37.660444 0 0 0 37.546667-37.762845V426.040889a37.660444 37.660444 0 0 0-37.546667-37.762845z" fill="#FFCA6C" />
          <path d="M87.381333 472.257422h638.850845v97.655467H87.381333z" fill="#4D4D4D" />
          <path d="M213.595022 692.974933a58.595556 58.254222 90 1 0 116.508445 0 58.595556 58.254222 90 1 0-116.508445 0Z" fill="#47A7DD" />
          <path d="M155.3408 692.974933a58.595556 58.254222 90 1 0 116.508444 0 58.595556 58.254222 90 1 0-116.508444 0Z" fill="#FC583D" />
          <path d="M894.509511 234.951111H720.406756c-8.044089 0-14.563556 6.5536-14.563556 14.6432s6.519467 14.654578 14.563556 14.654578h174.102755c12.686222 0 22.994489 10.376533 22.994489 23.131022v31.561956H307.768889V287.379911c0-12.754489 10.308267-23.131022 22.994489-23.131022H671.857778c8.044089 0 14.552178-6.564978 14.552178-14.654578S679.913244 234.951111 671.869156 234.951111h-341.105778c-28.740267 0-52.1216 23.517867-52.1216 52.417422v86.254934H124.928c-28.728889 0-52.110222 23.517867-52.110222 52.417422V663.665778c0 8.100978 6.519467 14.654578 14.563555 14.654578 8.044089 0 14.563556-6.564978 14.563556-14.654578v-79.086934h609.723733v183.9104c0 12.743111-10.308267 23.108267-22.983111 23.108267H124.928a23.074133 23.074133 0 0 1-22.983111-23.108267v-55.990044c0-8.0896-6.519467-14.6432-14.563556-14.6432-8.044089 0-14.563556 6.5536-14.563555 14.6432v55.990044c0 28.899556 23.381333 52.406044 52.110222 52.406045h563.757511c28.728889 0 52.110222-23.506489 52.110222-52.406045V426.040889c0-28.899556-23.381333-52.417422-52.110222-52.417422H307.780267v-25.383823h609.735111v68.357689H772.846933c-8.044089 0-14.563556 6.5536-14.563555 14.6432s6.519467 14.654578 14.563555 14.654578h144.668445v183.9104a23.096889 23.096889 0 0 1-22.994489 23.131022H774.781156c-8.044089 0-14.552178 6.5536-14.552178 14.6432s6.508089 14.6432 14.552178 14.6432h119.728355c28.728889 0 52.1216-23.506489 52.1216-52.417422V287.379911C946.631111 258.468978 923.249778 234.951111 894.509511 234.951111z m-182.840889 191.089778v31.573333H178.642489c-8.044089 0-14.563556 6.5536-14.563556 14.6432s6.519467 14.654578 14.563556 14.654578h533.026133v68.357689H101.944889v-68.357689h28.16c8.044089 0 14.563556-6.564978 14.563555-14.654578s-6.519467-14.6432-14.563555-14.6432H101.944889v-31.573333c0-12.743111 10.308267-23.119644 22.983111-23.119645h563.757511a23.096889 23.096889 0 0 1 22.983111 23.119645z" fill="currentColor" />
          <path d="M242.744889 760.069689a72.100978 72.100978 0 0 0 29.104355 6.155378c40.152178 0 72.817778-32.8704 72.817778-73.250134 0-40.402489-32.6656-73.250133-72.817778-73.250133-10.069333 0-19.979378 2.127644-29.104355 6.132622a72.078222 72.078222 0 0 0-29.149867-6.132622c-40.152178 0-72.817778 32.847644-72.817778 73.250133 0 40.379733 32.6656 73.250133 72.817778 73.250134 10.365156 0 20.218311-2.218667 29.149867-6.155378zm72.795022-67.094756c0 24.223289-19.603911 43.9296-43.690667 43.9296h-0.034133a73.056711 73.056711 0 0 0 14.609067-43.9296 73.079467 73.079467 0 0 0-14.609067-43.952355h0.034133c24.098133 0 43.690667 19.706311 43.690667 43.952355zm-145.624178 0c0-24.246044 19.592533-43.952356 43.690667-43.952356 24.086756 0 43.690667 19.706311 43.690667 43.952355 0 24.223289-19.603911 43.9296-43.690667 43.9296-24.098133 0.011378-43.690667-19.706311-43.690667-43.9296zM655.633067 647.5776c8.032711 0 14.563556-6.5536 14.563555-14.6432s-6.530844-14.6432-14.563555-14.6432H440.103822c-8.044089 0-14.563556 6.5536-14.563555 14.6432s6.519467 14.6432 14.563555 14.6432h215.529245z" fill="currentColor" />
        </svg>
      )
    },
    { 
      name: 'Credito', 
      icon: (
        <svg height="24" width="24" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xmlSpace="preserve">
          <path style={{ fill: '#B4E66E' }} d="M418.472,367.164H25.119c-9.446,0-17.102-7.656-17.102-17.102V93.528 c0-9.446,7.656-17.102,17.102-17.102h393.353c9.446,0,17.102,7.656,17.102,17.102v256.534 C435.574,359.508,427.918,367.164,418.472,367.164z"/>
          <path style={{ fill: '#A0D755' }} d="M401.37,204.693c-70.84,0-128.267,57.427-128.267,128.267c0,11.865,1.739,23.3,4.754,34.205h140.615 c9.445,0,17.102-7.658,17.102-17.102V209.447C424.669,206.432,413.234,204.693,401.37,204.693z"/>
          <path style={{ fill: '#FFC850' }} d="M136.284,204.693H67.875c-4.722,0-8.551-3.829-8.551-8.551v-51.307c0-4.722,3.829-8.551,8.551-8.551 h68.409c4.722,0,8.551,3.829,8.551,8.551v51.307C144.835,200.864,141.006,204.693,136.284,204.693z"/>
          <circle style={{ fill: '#FF507D' }} cx="294.48" cy="166.212" r="38.48"/>
          <circle style={{ fill: '#FFC850' }} cx="345.787" cy="166.212" r="38.48"/>
          <path style={{ fill: '#FF8C66' }} d="M307.307,166.212c0,11.352,5.008,21.451,12.827,28.493c7.819-7.043,12.827-17.142,12.827-28.493 c0-11.352-5.008-21.451-12.827-28.493C312.315,144.762,307.307,154.861,307.307,166.212z"/>
          <circle style={{ fill: '#FFFFFF' }} cx="401.37" cy="332.96" r="102.614"/>
          <path d="M273.102,359.148H25.119c-5.01,0-9.086-4.076-9.086-9.086V93.528c0-5.01,4.076-9.086,9.086-9.086h393.353 c5.01,0,9.086,4.076,9.086,9.086v111.167c0,4.427,3.589,8.017,8.017,8.017c4.427,0,8.017-3.589,8.017-8.017V93.528 c0-13.851-11.268-25.119-25.119-25.119H25.119C11.268,68.409,0,79.677,0,93.528v256.534c0,13.851,11.268,25.119,25.119,25.119 h247.983c4.427,0,8.017-3.589,8.017-8.017C281.119,362.737,277.53,359.148,273.102,359.148z"/>
          <path d="M401.37,222.329c-22.525,0-44.124,6.74-62.382,19.243l2.014-6.31c1.346-4.218-0.982-8.729-5.2-10.074 c-4.216-1.348-8.729,0.982-10.074,5.2l-10.51,32.937c-0.822,2.574-0.291,5.388,1.411,7.487c1.531,1.888,3.823,2.966,6.225,2.966 c0.268,0,0.539-0.014,0.809-0.041l34.397-3.488c4.405-0.447,7.614-4.38,7.168-8.784c-0.447-4.405-4.38-7.606-8.784-7.168 l-8.94,0.906c15.724-10.926,34.384-16.841,53.867-16.841c52.161,0,94.597,42.436,94.597,94.597 c0,51.636-41.587,93.734-93.027,94.577c0.001-0.006,0.002-0.013,0.004-0.019c-1.782,0.033-3.563,0.035-5.333-0.033 c-4.408-0.177-8.15,3.274-8.323,7.698c-0.173,4.424,3.274,8.15,7.698,8.323c1.452,0.057,2.927,0.085,4.384,0.085 c61.002,0,110.63-49.629,110.63-110.63S462.371,222.329,401.37,222.329z"/>
          <path d="M67.875,212.709h68.409c9.136,0,16.568-7.432,16.568-16.568v-51.307c0-9.136-7.432-16.568-16.568-16.568H67.875 c-9.136,0-16.568,7.432-16.568,16.568v51.307C51.307,205.277,58.739,212.709,67.875,212.709z M136.818,144.835v51.307 c0,0.295-0.239,0.534-0.534,0.534h-34.739v-18.171h9.086c4.427,0,8.017-3.589,8.017-8.017c0-4.427-3.589-8.017-8.017-8.017h-9.086 V144.3h34.739C136.579,144.3,136.818,144.54,136.818,144.835z M67.34,144.835c0-0.295,0.239-0.534,0.534-0.534h17.637v52.376H67.875 c-0.295,0-0.534-0.239-0.534-0.534V144.835z"/>
          <path d="M345.787,212.709c25.638,0,46.497-20.858,46.497-46.497s-20.858-46.497-46.497-46.497c-9.467,0-18.278,2.851-25.632,7.729 c-7.571-5.017-16.488-7.729-25.675-7.729c-25.638,0-46.497,20.858-46.497,46.497s20.858,46.497,46.497,46.497 c9.47,0,18.284-2.853,25.641-7.734C327.693,209.988,336.62,212.709,345.787,212.709z M376.251,166.212 c0,16.798-13.666,30.463-30.463,30.463c-4.773,0-9.444-1.129-13.651-3.237c5.554-7.66,8.841-17.064,8.841-27.227 c0-4.427-3.589-8.017-8.017-8.017c-4.427,0-8.017,3.589-8.017,8.017c0,6.037-1.772,11.666-4.814,16.404 c-3.102-4.848-4.806-10.52-4.806-16.404c0-16.798,13.666-30.463,30.463-30.463C362.585,135.749,376.251,149.415,376.251,166.212z M264.017,166.212c0-16.798,13.666-30.463,30.463-30.463c4.781,0,9.448,1.127,13.652,3.234c-5.555,7.66-8.842,17.065-8.842,27.229 c0,9.885,3.145,19.378,8.824,27.23c-4.106,2.064-8.734,3.233-13.634,3.233C277.683,196.676,264.017,183.01,264.017,166.212z"/>
          <path d="M59.324,272.567h68.409c4.427,0,8.017-3.589,8.017-8.017c0-4.427-3.589-8.017-8.017-8.017H59.324 c-4.427,0-8.017,3.589-8.017,8.017C51.307,268.978,54.896,272.567,59.324,272.567z"/>
          <path d="M59.324,323.874h205.228c4.427,0,8.017-3.589,8.017-8.017c0-4.427-3.589-8.017-8.017-8.017H59.324 c-4.427,0-8.017,3.589-8.017,8.017C51.307,320.285,54.896,323.874,59.324,323.874z"/>
          <path d="M230.347,272.567c4.427,0,8.017-3.589,8.017-8.017c0-4.427-3.589-8.017-8.017-8.017h-68.409 c-4.427,0-8.017,3.589-8.017,8.017c0,4.427,3.589,8.017,8.017,8.017H230.347z"/>
          <path d="M281.653,256.534h-17.102c-4.427,0-8.017,3.589-8.017,8.017c0,4.427,3.589,8.017,8.017,8.017h17.102 c4.427,0,8.017-3.589,8.017-8.017C289.67,260.123,286.081,256.534,281.653,256.534z"/>
          <path d="M299.519,289.7c-2.321,5.458-4.213,11.147-5.621,16.91c-1.051,4.3,1.583,8.64,5.884,9.691 c0.639,0.156,1.279,0.231,1.91,0.231c3.609,0,6.886-2.453,7.782-6.115c1.203-4.921,2.818-9.78,4.8-14.442 c1.733-4.075-0.166-8.782-4.24-10.515C305.959,283.727,301.252,285.626,299.519,289.7z"/>
          <path d="M309.522,355.698c-1.21-4.907-2.03-9.96-2.438-15.019c-0.356-4.412-4.215-7.7-8.635-7.346 c-4.413,0.356-7.702,4.221-7.346,8.635c0.477,5.916,1.437,11.827,2.853,17.57c0.901,3.655,4.175,6.099,7.777,6.099 c0.635,0,1.282-0.076,1.926-0.235C307.956,364.341,310.581,359.997,309.522,355.698z"/>
          <path d="M367.876,421.459c-4.732-1.791-9.359-3.987-13.751-6.525c-3.834-2.214-8.737-0.902-10.952,2.932 c-2.215,3.834-0.901,8.737,2.932,10.952c5.14,2.968,10.555,5.538,16.094,7.635c0.935,0.354,1.893,0.522,2.837,0.522 c3.237,0,6.285-1.974,7.499-5.18C374.102,427.654,372.017,423.027,367.876,421.459z"/>
          <path d="M321.443,383.585c-2.373-3.739-7.326-4.844-11.065-2.471c-3.738,2.373-4.844,7.327-2.471,11.065 c3.172,4.997,6.776,9.777,10.71,14.208c1.584,1.784,3.786,2.695,5.998,2.695c1.893,0,3.792-0.667,5.32-2.022 c3.311-2.939,3.612-8.007,0.672-11.317C327.241,391.95,324.158,387.86,321.443,383.585z"/>
          <path d="M375.182,357.01c0-4.427-3.589-8.017-8.017-8.017c-4.427,0-8.017,3.589-8.017,8.017c0,13.489,14.236,24.034,34.205,26.274 v0.982c0,4.427,3.589,8.017,8.017,8.017c4.427,0,8.017-3.589,8.017-8.017v-0.982c19.969-2.24,34.205-12.786,34.205-26.274 c0-18.805-18.787-25.929-34.205-30.21v-27.974c11.431,1.758,18.171,6.984,18.171,10.084c0,4.427,3.589,8.017,8.017,8.017 c4.427,0,8.017-3.589,8.017-8.017c0-13.489-14.236-24.034-34.205-26.274v-0.982c0-4.427-3.589-8.017-8.017-8.017 c-4.427,0-8.017,3.589-8.017,8.017v0.982c-19.969,2.24-34.205,12.786-34.205,26.274c0,18.805,18.787,25.929,34.205,30.21v27.974 C381.922,365.336,375.182,360.11,375.182,357.01z M427.557,357.01c0,3.1-6.74,8.326-18.171,10.084v-23.531 C422.758,347.768,427.557,351.521,427.557,357.01z M375.182,308.91c0-3.1,6.74-8.326,18.171-10.084v23.531 C379.981,318.151,375.182,314.398,375.182,308.91z"/>
        </svg>
      )
    },
    { 
      name: 'PayPal', 
      icon: (
        <svg viewBox="0 0 48 48" width="24" height="24">
          <path fill="#0d62ab" d="M18.7,13.767l0.005,0.002C18.809,13.326,19.187,13,19.66,13h13.472c0.017,0,0.034-0.007,0.051-0.006C32.896,8.215,28.887,6,25.35,6H11.878c-0.474,0-0.852,0.335-0.955,0.777l-0.005-0.002L5.029,33.813l0.013,0.001c-0.014,0.064-0.039,0.125-0.039,0.194c0,0.553,0.447,0.991,1,0.991h8.071L18.7,13.767z"></path>
          <path fill="#199be2" d="M33.183,12.994c0.053,0.876-0.005,1.829-0.229,2.882c-1.281,5.995-5.912,9.115-11.635,9.115c0,0-3.47,0-4.313,0c-0.521,0-0.767,0.306-0.88,0.54l-1.74,8.049l-0.305,1.429h-0.006l-1.263,5.796l0.013,0.001c-0.014,0.064-0.039,0.125-0.039,0.194c0,0.553,0.447,1,1,1h7.333l0.013-0.01c0.472-0.007,0.847-0.344,0.945-0.788l0.018-0.015l1.812-8.416c0,0,0.126-0.803,0.97-0.803s4.178,0,4.178,0c5.723,0,10.401-3.106,11.683-9.102C42.18,16.106,37.358,13.019,33.183,12.994z"></path>
          <path fill="#006fc4" d="M19.66,13c-0.474,0-0.852,0.326-0.955,0.769L18.7,13.767l-2.575,11.765c0.113-0.234,0.359-0.54,0.88-0.54c0.844,0,4.235,0,4.235,0c5.723,0,10.432-3.12,11.713-9.115c0.225-1.053,0.282-2.006,0.229-2.882C33.166,12.993,33.148,13,33.132,13H19.66z"></path>
        </svg>
      )
    },
    { 
      name: 'Zelle', 
      icon: (
        <svg viewBox="0 0 48 48" width="24" height="24">
          <path fill="#a0f" d="M35,42H13c-3.866,0-7-3.134-7-7V13c0-3.866,3.134-7,7-7h22c3.866,0,7,3.134,7,7v22C42,38.866,38.866,42,35,42z"></path>
          <path fill="#fff" d="M17.5,18.5h14c0.552,0,1-0.448,1-1V15c0-0.552-0.448-1-1-1h-14c-0.552,0-1,0.448-1,1v2.5C16.5,18.052,16.948,18.5,17.5,18.5z"></path>
          <path fill="#fff" d="M17,34.5h14.5c0.552,0,1-0.448,1-1V31c0-0.552-0.448-1-1-1H17c-0.552,0-1,0.448-1,1v2.5C16,34.052,16.448,34.5,17,34.5z"></path>
          <path fill="#fff" d="M22.25,11v6c0,0.276,0.224,0.5,0.5,0.5h3.5c0.276,0,0.5-0.224,0.5-0.5v-6c0-0.276-0.224-0.5-0.5-0.5h-3.5C22.474,10.5,22.25,10.724,22.25,11z"></path>
          <path fill="#fff" d="M22.25,32v6c0,0.276,0.224,0.5,0.5,0.5h3.5c0.276,0,0.5-0.224,0.5-0.5v-6c0-0.276-0.224-0.5-0.5-0.5h-3.5C22.474,31.5,22.25,31.724,22.25,32z"></path>
          <path fill="#fff" d="M16.578,30.938H22l10.294-12.839c0.178-0.222,0.019-0.552-0.266-0.552H26.5L16.275,30.298C16.065,30.553,16.247,30.938,16.578,30.938z"></path>
        </svg>
      )
    },
    { 
      name: 'Binance', 
      icon: (
        <svg viewBox="0 0 64 64" width="24" height="24">
          <path fill="orange" d="M33.721,25.702l2.583,2.581c0.944,0.944,0.944,2.477,0,3.421l-2.587,2.587c-0.944,0.944-2.477,0.944-3.421,0l-2.583-2.583c-0.944-0.944-0.944-2.477,0-3.421l2.587-2.585C31.243,24.758,32.777,24.758,33.721,25.702z"></path>
          <path fill="orange" d="M11.725,25.701l2.583,2.581c0.944,0.944,0.944,2.477,0,3.421l-2.587,2.587c-0.944,0.944-2.477,0.944-3.421,0l-2.583-2.583c-0.944-0.944-0.944-2.477,0-3.421l2.587-2.585C9.247,24.757,10.781,24.757,11.725,25.701z"></path>
          <path fill="orange" d="M55.718,25.701l2.583,2.581c0.944,0.944,0.944,2.477,0,3.421l-2.587,2.587c-0.944,0.944-2.477,0.944-3.421,0l-2.583-2.583c-0.944-0.944-0.944-2.477,0-3.421l2.587-2.585C53.241,24.757,54.774,24.757,55.718,25.701z"></path>
          <path fill="orange" d="M19.298,23.295l-2.581-2.583c-0.944-0.943-0.944-2.479,0-3.421l13.58-13.584c0.944-0.945,2.477-0.945,3.421-0.001l13.583,13.576c0.943,0.944,0.944,2.477,0,3.421l-2.587,2.588c-0.944,0.943-2.477,0.943-3.421-0.001l-9.284-9.292l-9.288,9.297C21.777,24.239,20.243,24.241,19.298,23.295z"></path>
          <path fill="orange" d="M19.297,36.701l-2.583,2.583c-0.944,0.944-0.944,2.477,0,3.421l13.58,13.585c0.944,0.944,2.477,0.944,3.421,0l13.583-13.576c0.944-0.944,0.944-2.477,0-3.421l-2.587-2.587c-0.944-0.944-2.477-0.944-3.421,0l-9.284,9.292l-9.288-9.297C21.774,35.757,20.241,35.757,19.297,36.701z"></path>
          <path fill="#fff" fillOpacity=".298" d="M16.715,17.293L30.297,3.707c0.944-0.945,2.477-0.945,3.421-0.001l13.583,13.577c-1.957,1.472-4.753,1.317-6.535-0.464l-8.76-8.752l-8.753,8.759C21.47,18.61,18.674,18.765,16.715,17.293z"></path>
          <path fill="#fff" fillRule="evenodd" d="M23.43,14.577c-0.585-0.585-0.585-1.536,0-2.121l3.024-3.024c0.585-0.585,1.536-0.585,2.121,0c0.585,0.585,0.585,1.536,0,2.121l-3.024,3.024C24.966,15.162,24.015,15.162,23.43,14.577z" clipRule="evenodd"></path>
          <path fillOpacity=".149" d="M16.715,42.706l13.581,13.585c0.944,0.945,2.477,0.945,3.421,0.001l13.583-13.577c-1.957-1.472-4.753-1.317-6.535,0.464l-8.76,8.752l-8.753-8.759C21.47,41.389,18.674,41.234,16.715,42.706z"></path>
          <path fillOpacity=".298" d="M58.009,61c0-1.656-11.648-3-26-3s-26,1.344-26,3c0,1.656,11.648,3,26,3S58.009,62.656,58.009,61z"></path>
        </svg>
      )
    },
    { 
      name: 'Zinli', 
      icon: (
        <svg viewBox="0 0 52 22" width="24" height="24">
          <path d="M49.84 6.554v13.954h-3.318V6.553h3.317zM22.4 6.554v13.954h-3.315V6.553H22.4zM43.579.995v19.513h-3.32V.995h3.32zM18.595 2.166a2.164 2.164 0 112.161 2.162 2.179 2.179 0 01-2.161-2.162zM46.04 3.166a2.163 2.163 0 112.163 2.162 2.179 2.179 0 01-2.164-2.162zM33.988 6.562v7.16l-8.235-7.14a.342.342 0 00-.568.251V20.52h3.317v-7.175l8.238 7.162a.344.344 0 00.57-.251V6.562h-3.322zM6.489 20.513h9.64v-3.315H9.364l-2.875 3.315zM4.612 20.507L16.23 7.114a.344.344 0 00-.251-.57H2.22V9.86h7.36L.725 19.947a.344.344 0 00.251.57l3.635-.01z" fill="#22c55e"></path>
        </svg>
      )
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-kawaii-pink font-bold mb-8 hover:translate-x-1 transition-transform group"
      >
        <div className="bg-kawaii-light-pink/20 p-2 rounded-full group-hover:bg-kawaii-pink group-hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </div>
        Volver al inicio
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: Image */}
        <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-50">
          <div className="aspect-square relative overflow-hidden rounded-[32px] bg-slate-50">
            <img
              src={displayImage}
              alt={product.Product}
              className="w-full h-full object-contain p-4"
            />

            {/* Favourite toggle. The grid card had one but the detail page did
                not, so the only way to save a product was from the listing. */}
            <button
              type="button"
              onClick={() => toggleFavorite(product.ItemID)}
              aria-label={saved ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              title={saved ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/90 backdrop-blur border border-[#ffe0ef] shadow-md flex items-center justify-center text-kawaii-pink hover:scale-110 active:scale-95 transition-transform"
            >
              <Heart size={22} strokeWidth={2.5} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Right: Info */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-4 bubble-font">{product.Product}</h1>
            <div className="flex items-center gap-4">
               <span className="text-3xl md:text-4xl font-black text-kawaii-pink">${product.USD.toFixed(2)}</span>
               <span className="text-2xl text-slate-300">|</span>
               <span className="text-lg md:text-xl font-bold text-slate-400">Bs {product.Bs.toFixed(2)}</span>
            </div>
            {shippingPriceMessage && (
              <p className="mt-2 text-kawaii-pink text-sm font-bold flex items-center gap-2 italic">
                📍 {shippingPriceMessage}
              </p>
            )}

            {/* Availability, straight from the resolved status so the badge and
                the buy buttons can never disagree. */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${STOCK_STATUS_CLASSES[stockStatus]}`}
              >
                {STOCK_STATUS_LABELS[stockStatus]}
              </span>
              {stockStatus === 'low_stock' && rawMaxStock > 0 && (
                <span className="text-xs font-bold text-amber-600">
                  Quedan {rawMaxStock} unidad{rawMaxStock === 1 ? '' : 'es'}
                </span>
              )}
              {stockStatus === 'unavailable' && (
                <span className="text-xs font-semibold text-slate-400">
                  Este producto no esta a la venta por ahora.
                </span>
              )}
            </div>
          </div>

          <p className="text-slate-500 leading-relaxed font-medium">
            {product.Description || 'Sin descripción disponible para este producto.'}
          </p>

          {/* Modelos / Variantes */}
          {hasVariants && (
            <div className="space-y-4">
              <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Selecciona el modelo que deseas:</h4>
              <div className="grid grid-cols-1 gap-3">
                  {variants?.map((v) => (
                    <div 
                     key={v.id}
                     onClick={() => handleVariantSelect(v)}
                     className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                       selectedVariant?.id === v.id 
                       ? 'border-kawaii-pink bg-kawaii-light-pink/10' 
                       : 'border-slate-100 hover:border-kawaii-pink/30'
                     }`}
                    >
                      <div className="flex items-center gap-3">
                        {v.image_path && (
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 flex-shrink-0 bg-slate-50">
                            <img 
                              src={v.image_path} 
                              alt={v.variant_name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <span className="font-bold text-slate-700">{v.variant_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-xs text-slate-400 font-bold">Stock: {v.stock_count}</span>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                           selectedVariant?.id === v.id ? 'border-kawaii-pink bg-kawaii-pink text-white' : 'border-slate-200'
                         }`}>
                           {selectedVariant?.id === v.id && <Check size={14} strokeWidth={4} />}
                         </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cantidad */}
          <div className="space-y-4">
            <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Quantity:</h4>
            <div className="flex items-center gap-6">
              <div className="flex items-center bg-slate-100 p-1.5 rounded-full border-2 border-slate-50 shadow-inner">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || maxStock === 0}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-kawaii-pink hover:bg-kawaii-pink hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-kawaii-pink disabled:cursor-not-allowed"
                >
                  <Minus size={18} strokeWidth={3} />
                </button>
                <span className="w-12 text-center font-black text-lg text-slate-700">{quantity}</span>
                <button 
                  onClick={() => setQuantity(Math.min(maxStock, quantity + 1))}
                  disabled={quantity >= maxStock || maxStock === 0}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-kawaii-pink hover:bg-kawaii-pink hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-kawaii-pink disabled:cursor-not-allowed"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col gap-4">
            {(() => {
              let addToCartText = "Agregar al Carrito";
              let isAddToCartDisabled = false;

              if (hasVariants) {
                if (!selectedVariant) {
                  addToCartText = "Selecciona un modelo";
                  isAddToCartDisabled = true;
                } else if (selectedVariant.stock_count === 0) {
                  addToCartText = "Agotado";
                  isAddToCartDisabled = true;
                }
              } else {
                if (product.Stock === 0) {
                  addToCartText = "Agotado";
                  isAddToCartDisabled = true;
                }
              }

              return (
                <button 
                  onClick={handleAddToCart}
                  disabled={isAddToCartDisabled}
                  className="w-full bg-kawaii-pink text-white py-5 rounded-full font-black text-lg uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 bubble-font disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <ShoppingBag size={24} />
                  {addToCartText}
                </button>
              );
            })()}
            {!hasVariants && (
              <button 
                onClick={() => onCheckout({ ...product, variant: selectedVariant }, quantity)}
                disabled={product.Stock === 0}
                className="w-full bg-white text-kawaii-pink border-2 border-kawaii-pink py-5 rounded-full font-black text-lg uppercase tracking-widest hover:bg-kawaii-light-pink/10 transition-all bubble-font disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Comprar ahora
              </button>
            )}
          </div>

          {/* Métodos de Pago */}
          <div className="pt-8 border-t border-slate-100">
             <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-6 text-center">Métodos de pago disponibles:</h4>
             <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {paymentMethods.map((m) => (
                  <div key={m.name} className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col items-center gap-2 hover:bg-kawaii-light-pink/5 transition-colors shadow-sm">
                    <span className="text-xl">{m.icon}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{m.name}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
