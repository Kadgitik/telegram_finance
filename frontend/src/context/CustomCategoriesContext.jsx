import { createContext, useContext, useState } from "react";

const CustomCategoriesContext = createContext([[], () => {}]);

export function CustomCategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  return (
    <CustomCategoriesContext.Provider value={[categories, setCategories]}>
      {children}
    </CustomCategoriesContext.Provider>
  );
}

export function useCustomCategories() {
  return useContext(CustomCategoriesContext);
}
