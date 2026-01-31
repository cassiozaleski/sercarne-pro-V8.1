import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart, Scale, Store, Package, AlertCircle, Loader2, Tag, Calendar, Info } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { schlosserRules } from '@/domain/schlosserRules';
import { calculateOrderMetrics, calculateWeight, calculateSubtotal } from '@/utils/calculateOrderMetrics';
import { getWeeklyStockSchedule, validateAndSuggestAlternativeDate } from '@/utils/stockValidator';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ProductCard = ({ product }) => {
  const { addToCart, stockUpdateTrigger, deliveryInfo, cartItems } = useCart();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  
  const [quantity, setQuantity] = useState(1);
  const [loadingStock, setLoadingStock] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [weeklyStock, setWeeklyStock] = useState([]);
  
  // Determine Pricing
  const { price } = schlosserRules.getTabelaAplicada(quantity, user, product.prices);
  const unit = product.unidade_estoque || 'UND';

  // Discount Logic
  const publicPrice = product.prices?.TAB3 || 0;
  let discountPercent = 0;
  if (user && publicPrice > 0) {
      discountPercent = ((publicPrice - price) / publicPrice) * 100;
  }
  const showDiscount = user && discountPercent > 1;

  // Debug Logging (Task 2)
  useEffect(() => {
    console.log('Produto:', product.codigo, 'peso_medio:', product.pesoMedio, 'preco_kg:', price);
  }, [product.codigo, product.pesoMedio, price]);

  // Metrics
  const tempItem = {
    ...product,
    quantidade: quantity,
    price: price,
    preco: price,
    peso: product.pesoMedio,
    tipoVenda: product.tipoVenda,
    unitType: unit
  };
  
  const { processedItems } = calculateOrderMetrics([tempItem]);
  const metrics = processedItems[0];
  const estimatedWeight = metrics.estimatedWeight;
  const estimatedSubtotal = metrics.estimatedValue;

  // Validations for safe display (Task 2)
  const isWeightValid = product.pesoMedio !== undefined && product.pesoMedio !== null && !isNaN(product.pesoMedio) && product.pesoMedio > 0;
  const isPriceValid = price !== undefined && price !== null && !isNaN(price) && price > 0;

  useEffect(() => {
    let isMounted = true;
    
    const fetchStock = async () => {
        if (!product.codigo) return;
        setLoadingStock(true);

        try {
            const schedule = await getWeeklyStockSchedule(product.codigo);
            if (isMounted) {
                setWeeklyStock(schedule);
            }
        } catch (error) {
            console.error(`Error fetching stock ${product.codigo}:`, error);
        } finally {
            if (isMounted) setLoadingStock(false);
        }
    };

    fetchStock();
    return () => { isMounted = false; };
  }, [product.codigo, stockUpdateTrigger]);

  const handleIncrement = () => setQuantity(prev => prev + 1);
  const handleDecrement = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const handleAdd = async () => {
      setAddingToCart(true);
      try {
          const targetDate = deliveryInfo?.delivery_date || new Date();
          const existingItem = cartItems.find(i => i.codigo === product.codigo);
          const totalQty = (existingItem?.quantidade || 0) + quantity;

          const validation = await validateAndSuggestAlternativeDate(product.codigo, totalQty, targetDate);

          if (!validation.isValid) {
              const b = validation.breakdown;
              const breakdownMsg = `Base: ${b.base} + Entradas: ${b.entradas} - Pedidos: ${b.pedidos} = Disponível: ${b.available}`;

              toast({
                  title: `Apenas ${validation.availableQty} UND disponível`,
                  description: breakdownMsg,
                  variant: "destructive",
                  duration: 5000
              });

              if (validation.suggestedDate) {
                  setTimeout(() => {
                    toast({
                        title: "Sugestão de Data",
                        description: `Temos estoque a partir de ${format(parseISO(validation.suggestedDate), 'dd/MM/yyyy')}.`,
                        className: "bg-blue-600 text-white border-blue-700"
                    });
                  }, 600);
              }
              return;
          }

          const productToAdd = { ...product, price: price, preco: price };
          addToCart(productToAdd, quantity);
          setQuantity(1);
          toast({ 
              title: "Produto adicionado", 
              description: `${quantity} ${unit} de ${product.descricao}` 
          });

      } catch (error) {
          console.error("Add to cart error:", error);
          toast({
              title: "Erro",
              description: "Não foi possível validar o estoque. Tente novamente.",
              variant: "destructive"
          });
      } finally {
          setAddingToCart(false);
      }
  };

  const formatMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatWeight = (value) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const displayImage = product.imagem || 'https://via.placeholder.com/300?text=Sem+Imagem';
  
  // Calculate if item is totally out for next 7 days
  const isTotallyOutOfStock = !loadingStock && weeklyStock.every(d => d.qty <= 0);

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col h-full border border-gray-100 group">
        {/* Image */}
        <div className="relative aspect-square bg-white p-4 flex items-center justify-center border-b border-gray-50">
            <img 
                src={displayImage}
                alt={product.descricao}
                className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform group-hover:scale-105"
                loading="lazy"
            />
            <div className="absolute bottom-2 left-2">
                <Badge className="bg-[#FF6B35] hover:bg-[#FF6B35] text-white font-mono font-bold text-xs px-2 shadow-sm rounded-sm">
                    #{product.codigo}
                </Badge>
            </div>
            {showDiscount && (
                <div className="absolute top-2 right-2 animate-in zoom-in spin-in-3">
                    <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-2 py-1 shadow-md border border-green-700">
                        {discountPercent.toFixed(0)}% OFF
                    </Badge>
                </div>
            )}
        </div>
        
        {/* Content */}
        <div className="p-4 flex flex-col flex-grow">
            <div className="mb-3">
                <h3 className="font-bold text-gray-900 leading-tight text-sm uppercase mb-1 line-clamp-2">
                    {product.descricao}
                </h3>
                {product.descricao_complementar && (
                    <p className="text-xs text-gray-500 font-medium uppercase leading-snug line-clamp-2">
                        {product.descricao_complementar}
                    </p>
                )}
            </div>

            {/* Price Info */}
            <div className="mb-4">
                <div className="flex flex-col mb-1">
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-[#FF6B35]">{formatMoney(price)}</span>
                        <span className="text-xs text-gray-400 font-bold uppercase">/ KG</span>
                    </div>
                    {showDiscount && (
                        <div className="flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-green-100">
                            <Tag size={10} />
                            <span>{discountPercent.toFixed(0)}% abaixo do preço público</span>
                        </div>
                    )}
                </div>
                
                <div className="inline-flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold text-gray-500 uppercase mt-1">
                    <Scale size={10} />
                    Peso Médio: {formatWeight(product.pesoMedio || 0)} kg
                </div>
            </div>

            {/* Available Stock by Date */}
            <div className="mb-4 space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                    <Calendar size={12} className="text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                        Estoque Disponível por Data
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger><Info size={10} className="text-gray-300" /></TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">Estoque futuro baseado nas entradas confirmadas.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                
                {loadingStock ? (
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {[1,2,3].map(i => <div key={i} className="h-6 w-16 bg-gray-100 rounded animate-pulse" />)}
                    </div>
                ) : (
                    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                        {weeklyStock.slice(0, 5).map((stock, idx) => {
                            const dateObj = parseISO(stock.date);
                            const isAvailable = stock.qty >= quantity;
                            const isZero = stock.qty <= 0;
                            
                            return (
                                <TooltipProvider key={idx}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className={`
                                                flex flex-col items-center justify-center min-w-[50px] px-1 py-1 rounded border text-[9px] cursor-help
                                                ${isAvailable 
                                                    ? 'bg-green-50 border-green-200 text-green-800' 
                                                    : (isZero ? 'bg-gray-50 border-gray-100 text-gray-300' : 'bg-red-50 border-red-200 text-red-800')
                                                }
                                            `}>
                                                <span className="font-bold uppercase mb-0.5">{format(dateObj, 'dd/MM')}</span>
                                                <span className="font-bold text-[10px]">{stock.qty}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px]">
                                            <p>{format(dateObj, "dd 'de' MMMM", {locale: ptBR})}</p>
                                            <p className="font-bold">Disponível: {stock.qty} UND</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="mt-auto space-y-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1 border border-gray-200">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleDecrement}
                        disabled={quantity <= 1 || isTotallyOutOfStock || addingToCart}
                        className="h-8 w-10 text-gray-500 hover:text-gray-900 hover:bg-white"
                    >
                        <Minus size={14} />
                    </Button>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-lg text-gray-900 leading-none">{quantity}</span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{unit}</span>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleIncrement}
                        disabled={isTotallyOutOfStock || addingToCart}
                        className="h-8 w-10 text-gray-500 hover:text-gray-900 hover:bg-white"
                    >
                        <Plus size={14} />
                    </Button>
                </div>

                {/* Estimates Display */}
                <div className="bg-[#FFF8F4] rounded px-3 py-2 space-y-1 border border-orange-100/50">
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Peso Estimado:</span>
                        <span className="font-medium text-gray-700">
                            {isWeightValid ? `${formatWeight(estimatedWeight)} kg` : 'Informação não disponível'}
                        </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 border-t border-orange-100 pt-1">
                        <span className="font-bold text-[#FF6B35]">Subtotal Estimado:</span>
                        <span className="font-bold text-[#FF6B35]">
                             {isWeightValid && isPriceValid ? formatMoney(estimatedSubtotal) : 'Informação não disponível'}
                        </span>
                    </div>
                </div>

                <Button 
                    className="w-full bg-[#FF6B35] hover:bg-[#E65100] text-white font-bold h-10 shadow-sm transition-all active:scale-[0.98]"
                    onClick={handleAdd}
                    disabled={isTotallyOutOfStock || addingToCart}
                >
                    {addingToCart ? <Loader2 size={16} className="animate-spin mr-2"/> : <ShoppingCart size={16} className="mr-2" />}
                    {isTotallyOutOfStock ? 'Indisponível' : (addingToCart ? 'Validando...' : 'ADICIONAR')}
                </Button>
            </div>
        </div>
    </div>
  );
};

export default ProductCard;