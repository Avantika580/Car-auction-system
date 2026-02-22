package abstractComplex;
import java.util.Scanner;



abstract class Complex {
    double real;
    double imag;

    Complex(double real, double imag) 
    {
        this.real = real;
        this.imag = imag;
    }

    abstract Complex Add(Complex other);

    abstract Complex Sub(Complex other);

    abstract Complex Mul(Complex other);

    abstract Complex Div(Complex other);

    @Override
    abstract public String toString();
}

class Com extends Complex 
{
    Com(double real, double imag) 
    {
        super(real, imag);
    }

    @Override
    Complex Add(Complex other)
    {
        return new Com(this.real + other.real, this.imag + other.imag);
    }

    @Override
    Complex Sub(Complex other) 
    {
        return new Com(this.real - other.real, this.imag - other.imag);
    }

    @Override
    Complex Mul(Complex other) 
    {
        double realPart = this.real * other.real - this.imag * other.imag;
        double imagPart = this.real * other.imag + this.imag * other.real;
        return new Com(realPart, imagPart);
    }

    @Override
    Complex Div(Complex other) 
    {
    	try
    	{
	        double denom = Math.pow(other.real, 2) + Math.pow(other.imag, 2); // c^2 + d^2
	        if(denom==0)
	        {
	        	throw new ArithmeticException("Denominator cannot be zero");
	        }
	        double realDiv = (this.real * other.real + this.imag * other.imag) / denom;  // (ac + bd) / (c^2 + d^2)
	        double imagDiv = (this.imag * other.real - this.real * other.imag) / denom;  // (bc - ad) / (c^2 + d^2)
	        
	      
	        return new Com(realDiv,imagDiv) ;
        }
        catch(ArithmeticException e)
    	{
        	System.out.println("Error:"+e.getMessage());
        	return null;
    	}
    }

    @Override
    public String toString()
    {
    	if (imag < 0) 
    	{
            return real + " - " + Math.abs(imag) + "i";
        } 
    	else 
    	{
            return real + " + " + imag + "i";
        }
    		
    }
}

public class ComplexAbstract {

    public static void main(String[] args) 
    {
        Scanner scanner = new Scanner(System.in);
        double real1, imag1, real2, imag2;
        int choice;
        Complex num1, num2, result;

        System.out.println("Enter the real and imaginary parts of the first complex number:");
        System.out.print("Real: ");
        real1 = scanner.nextDouble();
        System.out.print("Imaginary: ");
        imag1 = scanner.nextDouble();

        System.out.println("Enter the real and imaginary parts of the second complex number:");
        System.out.print("Real: ");
        real2 = scanner.nextDouble();
        System.out.print("Imaginary: ");
        imag2 = scanner.nextDouble();

        num1 = new Com(real1, imag1);
        num2 = new Com(real2, imag2);

        do 
        {
            System.out.println("\nMenu:");
            System.out.println("1. Add");
            System.out.println("2. Subtract");
            System.out.println("3. Multiply");
            System.out.println("4. Divide");
            System.out.println("5. Exit");
            System.out.print("Enter your choice: ");
            choice = scanner.nextInt();

            switch (choice) 
            {
                case 1:
                    result = num1.Add(num2);
                    System.out.println("Addition: " + result);
                    break;
                case 2:
                    result = num1.Sub(num2);
                    System.out.println("Subtraction: " + result);
                    break;
                case 3:
                    result = num1.Mul(num2);
                    System.out.println("Multiplication: " + result);
                    break;
                case 4:
                    result = num1.Div(num2);
                    if (result != null) 
                    {
                        System.out.println("Division: " + result);
                    }
                    break;
                case 5:
                    System.out.println("Exiting...");
                    break;
                default:
                    System.out.println("Invalid choice. Please try again.");
            }
        } while (choice != 5);

        scanner.close();
    }
}